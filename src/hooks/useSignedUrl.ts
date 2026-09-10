/**
 * Mints a signed URL for a private receipt at render time and re-mints it
 * shortly before it expires. The URL only ever lives in component state —
 * it is never written to AsyncStorage, the cache, or the database.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError } from '../lib/errors';
import { getReceiptSignedUrl } from '../lib/receipts';

export interface SignedUrlState {
  url: string | null;
  loading: boolean;
  error: AppError | null;
  refresh(): void;
}

export function useSignedUrl(path: string | null, expiresIn = 300): SignedUrlState {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [error, setError] = useState<AppError | null>(null);
  // Bumping this re-runs the effect below without changing `path`.
  const [nonce, setNonce] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setNonce(n => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!path) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    getReceiptSignedUrl(path, expiresIn)
      .then(signed => {
        if (cancelled) {
          return;
        }
        setUrl(signed);
        setLoading(false);
        // Re-mint at 80% of the lifetime so an on-screen image never goes stale.
        timerRef.current = setTimeout(refresh, Math.max(1, expiresIn * 0.8) * 1000);
      })
      .catch(err => {
        if (cancelled) {
          return;
        }
        setUrl(null);
        setError(AppError.from(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [path, expiresIn, nonce, refresh]);

  return { url, loading, error, refresh };
}
