import { z } from 'zod';

/** Machine-readable error codes returned by the API. */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'LIMIT_REACHED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Every non-2xx API response has this shape. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    /** Field-level validation issues, keyed by dotted path. */
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, query: PaginationQuery): Paginated<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number(),
  checks: z.object({ database: z.enum(['ok', 'error']) }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
