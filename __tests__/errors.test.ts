import { AppError, getErrorMessage, isAppErrorKind } from '../src/lib/errors';

describe('AppError.from', () => {
  it('maps PostgREST 42501 (RLS insufficient_privilege) to permission', () => {
    const err = AppError.from({ code: '42501', message: 'permission denied for table kharcha' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.kind).toBe('permission');
    expect(err.message).toBe("You don't have permission to do that.");
  });

  it('maps HTTP 403 to permission', () => {
    expect(AppError.from({ status: 403, message: 'Forbidden' }).kind).toBe('permission');
  });

  it('maps PGRST116 (.single() matched no rows) to not_found', () => {
    const err = AppError.from({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
    expect(err.kind).toBe('not_found');
    expect(err.message).toBe('Not found, or you no longer have access.');
  });

  it('maps "Network request failed" to network', () => {
    const err = AppError.from(new TypeError('Network request failed'));
    expect(err.kind).toBe('network');
    expect(err.message).toBe('No connection. Check your network and try again.');
  });

  it('maps other fetch failures and timeouts to network', () => {
    expect(AppError.from(new Error('Failed to fetch')).kind).toBe('network');
    expect(AppError.from(new Error('fetch failed')).kind).toBe('network');
    expect(AppError.from(new Error('Request timeout')).kind).toBe('network');
  });

  it('maps 23514 (check_violation) to validation and keeps the DB message', () => {
    const err = AppError.from({
      code: '23514',
      message: 'new row for relation "kharcha" violates check constraint "kharcha_visibility_check"',
    });
    expect(err.kind).toBe('validation');
    expect(err.message).toContain('violates check constraint');
  });

  it('maps any 23xxx integrity error to validation', () => {
    expect(AppError.from({ code: '23505', message: 'duplicate key' }).kind).toBe('validation');
    expect(AppError.from({ code: '23503', message: 'fk violation' }).kind).toBe('validation');
  });

  it('maps Supabase AuthApiError to auth', () => {
    const cause = { name: 'AuthApiError', message: 'Invalid login credentials', status: 400 };
    const err = AppError.from(cause);
    expect(err.kind).toBe('auth');
    expect(err.message).toBe('Invalid login credentials');
    expect(err.cause).toBe(cause);
  });

  it('maps HTTP 401 to auth', () => {
    expect(AppError.from({ status: 401, message: 'JWT expired' }).kind).toBe('auth');
  });

  it('maps Supabase StorageApiError to storage', () => {
    expect(AppError.from({ name: 'StorageApiError', message: 'Object not found' }).kind).toBe(
      'storage',
    );
  });

  it('returns the same instance when given an AppError', () => {
    const original = new AppError('validation', 'Amount is required');
    expect(AppError.from(original)).toBe(original);
  });

  it('falls back to unknown with the given message for unrecognised errors', () => {
    const err = AppError.from(new Error('boom'));
    expect(err.kind).toBe('unknown');
    expect(err.message).toBe('boom');
  });

  it('uses the fallback message for non-object input', () => {
    expect(AppError.from(undefined).message).toBe('Something went wrong. Please try again.');
    expect(AppError.from('nope', 'Custom fallback').message).toBe('Custom fallback');
    expect(AppError.from(null).kind).toBe('unknown');
  });

  it('accepts a numeric statusCode string', () => {
    expect(AppError.from({ statusCode: '404', message: 'x' }).kind).toBe('not_found');
  });

  it('prefers the network classification over status codes', () => {
    expect(AppError.from({ status: 403, message: 'Network request failed' }).kind).toBe(
      'network',
    );
  });
});

describe('getErrorMessage', () => {
  it('returns the normalised message', () => {
    expect(getErrorMessage({ code: '42501' })).toBe("You don't have permission to do that.");
  });

  it('falls back to a generic message for garbage input', () => {
    expect(getErrorMessage(42)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage({})).toBe('Something went wrong. Please try again.');
  });
});

describe('isAppErrorKind', () => {
  it('checks the normalised kind', () => {
    expect(isAppErrorKind({ code: 'PGRST116' }, 'not_found')).toBe(true);
    expect(isAppErrorKind({ code: 'PGRST116' }, 'auth')).toBe(false);
  });
});
