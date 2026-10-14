import { apiErrorSchema, type ErrorCode } from '@um/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** First error message for a form field, if any. */
  field(name: string): string | undefined {
    return this.fieldErrors[name]?.[0];
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Called whenever an authenticated request comes back 401 (session expired/revoked). */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Typed JSON fetch against the API. Throws ApiError for every non-2xx response. */
export async function api<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}) {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal ?? null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the API running?');
  }

  if (res.status === 204) return undefined as T;
  const payload: unknown = await res.json().catch(() => null);
  if (res.ok) return payload as T;

  const parsed = apiErrorSchema.safeParse(payload);
  const error = parsed.success
    ? new ApiError(
        res.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.fieldErrors,
      )
    : new ApiError(res.status, 'INTERNAL_ERROR', `Request failed (${res.status})`);
  if (res.status === 401 && !path.startsWith('/api/auth/')) unauthorizedHandler?.();
  throw error;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
