import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse,
  type UserDto,
} from '@um/shared';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config';
import type { Db } from '../db';
import type { User } from '../generated/prisma/client';
import { AppError, parseInput } from '../lib/errors';

interface AuthRoutesOptions {
  config: AppConfig;
  db: Db;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance, { config, db }: AuthRoutesOptions) {
  // Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
  const dummyHash = await bcrypt.hash('timing-equaliser', config.BCRYPT_ROUNDS);
  const rateLimit = { max: config.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' };

  app.post('/register', { config: { rateLimit } }, async (request, reply) => {
    const input = parseInput(registerRequestSchema, request.body);
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this email already exists', {
        email: ['An account with this email already exists'],
      });
    }
    const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_ROUNDS);
    const user = await db.user.create({
      data: { email: input.email, displayName: input.displayName, passwordHash },
    });
    await app.startSession(user.id, request, reply);
    const response: AuthResponse = { user: toUserDto(user) };
    return reply.status(201).send(response);
  });

  app.post('/login', { config: { rateLimit } }, async (request, reply) => {
    const input = parseInput(loginRequestSchema, request.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new AppError('UNAUTHORIZED', 'Incorrect email or password');

    // Opportunistic housekeeping: drop this user's expired or revoked sessions.
    await db.session.deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
    await app.startSession(user.id, request, reply);
    const response: AuthResponse = { user: toUserDto(user) };
    return response;
  });

  app.post('/logout', async (request, reply) => {
    await app.endSession(request, reply);
    return reply.status(204).send();
  });

  app.get('/me', async (request) => {
    const { userId } = await app.authenticate(request);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('UNAUTHORIZED', 'You need to sign in');
    const response: AuthResponse = { user: toUserDto(user) };
    return response;
  });
}
