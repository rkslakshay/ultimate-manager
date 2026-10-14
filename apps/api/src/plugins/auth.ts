import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { AppConfig } from '../config';
import type { Db } from '../db';
import { AppError } from '../lib/errors';

export const SESSION_COOKIE = 'um_session';

interface TokenPayload {
  /** User id. */
  sub: string;
  /** Session id (row in the Session table). */
  sid: string;
}

export interface AuthContext {
  userId: string;
  sessionId: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Verify the session cookie; throws UNAUTHORIZED when missing, invalid, expired or revoked. */
    authenticate(request: FastifyRequest): Promise<AuthContext>;
    /** Create a session for a user and set the session cookie. */
    startSession(userId: string, request: FastifyRequest, reply: FastifyReply): Promise<void>;
    /** Revoke the current session (if any) and clear the cookie. Never throws for bad tokens. */
    endSession(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

interface AuthPluginOptions {
  config: AppConfig;
  db: Db;
}

async function authPlugin(app: FastifyInstance, { config, db }: AuthPluginOptions) {
  const ttlMs = config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

  await app.register(cookie);
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.NODE_ENV === 'production',
    path: '/',
  };

  async function readToken(request: FastifyRequest): Promise<TokenPayload | null> {
    try {
      return await request.jwtVerify<TokenPayload>();
    } catch {
      return null;
    }
  }

  app.decorate('authenticate', async (request: FastifyRequest): Promise<AuthContext> => {
    const payload = await readToken(request);
    if (!payload) throw new AppError('UNAUTHORIZED', 'You need to sign in');
    const session = await db.session.findUnique({ where: { id: payload.sid } });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new AppError('UNAUTHORIZED', 'Your session has expired, please sign in again');
    }
    return { userId: session.userId, sessionId: session.id };
  });

  app.decorate(
    'startSession',
    async (userId: string, request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const expiresAt = new Date(Date.now() + ttlMs);
      const userAgent = request.headers['user-agent']?.slice(0, 255) ?? null;
      const session = await db.session.create({ data: { userId, expiresAt, userAgent } });
      const token = await reply.jwtSign(
        { sub: userId, sid: session.id },
        { expiresIn: Math.floor(ttlMs / 1000) },
      );
      void reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    },
  );

  app.decorate('endSession', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = await readToken(request);
    if (payload) {
      await db.session.updateMany({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    void reply.clearCookie(SESSION_COOKIE, cookieOptions);
  });
}

export default fp(authPlugin, { name: 'auth' });
