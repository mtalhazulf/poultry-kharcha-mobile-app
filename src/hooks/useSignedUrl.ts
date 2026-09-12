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
  /** The path the current URL belongs to, so a re-mint can keep it on screen. */
  const urlPathRef = useRef<string | null>(null);

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
      urlPathRef.current = null;
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    // A re-mint (the timer below) keeps the URL it replaces on screen: blanking
    // it would swap the drawn receipt for a spinner and force a full
    // re-download every few minutes. Only a new path starts from nothing.
    const reminting = urlPathRef.current === path;
    if (!reminting) {
      setUrl(null);
    }
    setLoading(!reminting);
    setError(null);
    getReceiptSignedUrl(path, expiresIn)
      .then(signed => {
        if (cancelled) {
          return;
        }
        urlPathRef.current = path;
        setUrl(signed);
        setLoading(false);
        // Re-mint at 80% of the lifetime so an on-screen image never goes stale.
        timerRef.current = setTimeout(refresh, Math.max(1, expiresIn * 0.8) * 1000);
      })
      .catch(err => {
        if (cancelled) {
          return;
        }
        urlPathRef.current = null;
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
