/**
 * Normalises the three error shapes we see (Supabase Auth, PostgREST/RLS,
 * fetch/network) into one type the UI can switch on.
 */
export type AppErrorKind =
  | 'auth'
  | 'network'
  | 'permission'
  | 'not_found'
  | 'validation'
  | 'storage'
  | 'unknown';

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
  statusCode?: unknown;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  override readonly cause?: unknown;

  constructor(kind: AppErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.cause = cause;
  }

  static from(err: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
    if (err instanceof AppError) {
      return err;
    }
    const e = (typeof err === 'object' && err !== null ? err : {}) as ErrorLike;
    const message = typeof e.message === 'string' ? e.message : fallback;
    const code = typeof e.code === 'string' ? e.code : undefined;
    const status =
      typeof e.status === 'number'
        ? e.status
        : typeof e.statusCode === 'number'
          ? e.statusCode
          : typeof e.statusCode === 'string'
            ? Number(e.statusCode)
            : undefined;
    const name = typeof e.name === 'string' ? e.name : undefined;

    if (/network request failed|failed to fetch|fetch failed|timeout/i.test(message)) {
      return new AppError('network', 'No connection. Check your network and try again.', err);
    }
    // PostgREST: 42501 = insufficient_privilege (RLS rejected the statement).
    if (code === '42501' || status === 403) {
      return new AppError('permission', "You don't have permission to do that.", err);
    }
    // PGRST116 = .single() matched zero rows (also what RLS-hidden rows look like).
    if (code === 'PGRST116' || status === 404) {
      return new AppError('not_found', 'Not found, or you no longer have access.', err);
    }
    // 23xxx = integrity constraint violations (bad input the DB rejected).
    if (code && code.startsWith('23')) {
      return new AppError('validation', message, err);
    }
    if (name === 'AuthError' || name === 'AuthApiError' || status === 401) {
      return new AppError('auth', message, err);
    }
    if (name === 'StorageError' || name === 'StorageApiError' || name === 'StorageUnknownError') {
      return new AppError('storage', message, err);
    }
    return new AppError('unknown', message, err);
  }
}

export function getErrorMessage(err: unknown): string {
  return AppError.from(err).message;
}

export function isAppErrorKind(err: unknown, kind: AppErrorKind): boolean {
  return AppError.from(err).kind === kind;
}
