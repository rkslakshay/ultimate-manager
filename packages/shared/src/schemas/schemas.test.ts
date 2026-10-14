import { describe, expect, it } from 'vitest';
import { GAME_SECTIONS } from '../navigation';
import { paginate, paginationQuerySchema } from './common';
import { createSaveRequestSchema } from './saves';
import { loginRequestSchema, registerRequestSchema } from './auth';

describe('auth schemas', () => {
  it('normalises email and accepts a valid registration', () => {
    const parsed = registerRequestSchema.parse({
      email: '  Coach@Example.COM ',
      password: 'abc12345',
      displayName: ' Alex ',
    });
    expect(parsed.email).toBe('coach@example.com');
    expect(parsed.displayName).toBe('Alex');
  });

  it('rejects weak passwords and bad emails', () => {
    const base = { email: 'x@y.io', displayName: 'Al' };
    expect(registerRequestSchema.safeParse({ ...base, password: 'short1' }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ ...base, password: 'nodigitshere' }).success).toBe(
      false,
    );
    expect(loginRequestSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(
      false,
    );
  });
});

describe('save schemas', () => {
  it('validates the optional seed format and name', () => {
    const ok = createSaveRequestSchema.safeParse({ name: 'S', managerName: 'Al', seed: 'abc-1' });
    expect(ok.success).toBe(true);
    const badSeed = createSaveRequestSchema.safeParse({
      name: 'S',
      managerName: 'Al',
      seed: 'a b',
    });
    expect(badSeed.success).toBe(false);
    expect(createSaveRequestSchema.safeParse({ name: '  ', managerName: 'Al' }).success).toBe(
      false,
    );
  });
});

describe('pagination', () => {
  it('coerces query strings and applies defaults and bounds', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '20' })).toEqual({
      page: 3,
      pageSize: 20,
    });
    expect(paginationQuerySchema.safeParse({ pageSize: '1000' }).success).toBe(false);
  });

  it('computes total pages', () => {
    expect(paginate([1, 2], 45, { page: 1, pageSize: 20 }).totalPages).toBe(3);
    expect(paginate([], 0, { page: 1, pageSize: 20 }).totalPages).toBe(1);
  });
});

describe('navigation', () => {
  it('has unique ids and shortcuts', () => {
    expect(new Set(GAME_SECTIONS.map((s) => s.id)).size).toBe(GAME_SECTIONS.length);
    expect(new Set(GAME_SECTIONS.map((s) => s.shortcut)).size).toBe(GAME_SECTIONS.length);
  });
});
