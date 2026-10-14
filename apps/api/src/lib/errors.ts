import type { ApiErrorBody, ErrorCode } from '@um/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LIMIT_REACHED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/** An expected, client-facing error. Anything else is reported as INTERNAL_ERROR. */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = STATUS_BY_CODE[code];
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`);

/** Parse untrusted input with a Zod schema, throwing a VALIDATION_ERROR on failure. */
export function parseInput<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  throw new AppError('VALIDATION_ERROR', 'Request validation failed', fieldErrors);
}

function body(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
  const error: ApiErrorBody['error'] = { code, message };
  if (fieldErrors) error.fieldErrors = fieldErrors;
  return { error };
}

/** Install consistent JSON error responses for every failure path. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    void reply
      .status(404)
      .send(body('NOT_FOUND', `Route ${request.method} ${request.url} not found`));
  });

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(body(error.code, error.message, error.fieldErrors));
    }
    const status = error.statusCode ?? 500;
    if (status === 429) {
      return reply.status(429).send(body('RATE_LIMITED', 'Too many requests, slow down'));
    }
    if (status >= 400 && status < 500) {
      // Fastify-level client errors: malformed JSON, payload too large, wrong content type...
      const code: ErrorCode =
        status === 401 ? 'UNAUTHORIZED' : status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST';
      return reply.status(status).send(body(code, error.message));
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send(body('INTERNAL_ERROR', 'Something went wrong'));
  });
}
