import { z } from 'zod';

const DEV_SECRET_PREFIX = 'dev-only';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    /** Root of the data-packs folder (default: <repo>/data-packs). */
    DATA_PACKS_DIR: z.string().optional(),
    /** Max auth attempts (login/register) per IP per minute. */
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(20),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.JWT_SECRET.startsWith(DEV_SECRET_PREFIX), {
    message: 'JWT_SECRET must be changed from the development default in production',
    path: ['JWT_SECRET'],
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  return result.data;
}
