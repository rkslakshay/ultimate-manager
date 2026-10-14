import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../src/plugins/auth';
import {
  createTestApp,
  registerUser,
  sessionCookieFrom,
  uniqueEmail,
  type TestContext,
} from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

describe('POST /api/auth/register', () => {
  it('creates a user, sets an httpOnly session cookie and never returns the hash', async () => {
    const email = uniqueEmail();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: email.toUpperCase(), password: 'secret123', displayName: 'Pep' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({ email, displayName: 'Pep' });
    expect(JSON.stringify(body)).not.toContain('passwordHash');
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');

    const stored = await ctx.db.user.findUnique({ where: { email } });
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate emails with 409', async () => {
    const { email } = await registerUser(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'secret123', displayName: 'Again' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('returns field errors for invalid input', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'nope', password: 'short', displayName: '' },
    });
    expect(res.statusCode).toBe(400);
    const { error } = res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(error.fieldErrors)).toEqual(
      expect.arrayContaining(['email', 'password', 'displayName']),
    );
  });

  it('rejects malformed JSON with a consistent error body', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: '{bad json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
  });
});

describe('login / me / logout', () => {
  it('logs in with correct credentials and rejects wrong ones', async () => {
    const { email } = await registerUser(ctx.app);
    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'wrongpass1' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe('UNAUTHORIZED');

    const unknown = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: uniqueEmail(), password: 'secret123' },
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().error.message).toBe(bad.json().error.message);

    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'secret123' },
    });
    expect(ok.statusCode).toBe(200);
    expect(sessionCookieFrom(ok)).toBeTruthy();
  });

  it('GET /me requires a valid session', async () => {
    const anon = await ctx.app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(anon.statusCode).toBe(401);

    const forged = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { [SESSION_COOKIE]: 'not.a.jwt' },
    });
    expect(forged.statusCode).toBe(401);

    const { cookies, email } = await registerUser(ctx.app);
    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', cookies });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe(email);
  });

  it('logout revokes the session server-side, even if the token is replayed', async () => {
    const { cookies } = await registerUser(ctx.app);
    const out = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', cookies });
    expect(out.statusCode).toBe(204);
    const cleared = out.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cleared?.value).toBe('');

    const replay = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', cookies });
    expect(replay.statusCode).toBe(401);
  });

  it('logout without a session is a harmless no-op', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(204);
  });

  it('rejects tokens whose session has expired', async () => {
    const { cookies, user } = await registerUser(ctx.app);
    await ctx.db.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', cookies });
    expect(res.statusCode).toBe(401);
  });
});

describe('rate limiting', () => {
  it('limits repeated login attempts', async () => {
    const limited = await createTestApp({ RATE_LIMIT_AUTH_MAX: '3' });
    try {
      const attempt = () =>
        limited.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: uniqueEmail(), password: 'secret123' },
        });
      for (let i = 0; i < 3; i++) expect((await attempt()).statusCode).toBe(401);
      const blocked = await attempt();
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error.code).toBe('RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });
});
