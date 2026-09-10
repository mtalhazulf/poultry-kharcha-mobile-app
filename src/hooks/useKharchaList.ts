/**
 * Source of truth for the dashboard list: cache-first load, network refresh,
 * Supabase Realtime for live updates, and a refetch whenever the app comes
 * back to the foreground.
 *
 * Access control lives in RLS (see supabase/migrations): `listKharcha` sends
 * no owner filter and the Realtime channel subscribes to whole tables. The
 * server only returns/pushes rows the current user is allowed to read.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { listKharcha } from '../api/kharcha';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import { readKharchaCache, writeKharchaCache } from '../lib/offlineCache';
import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database';
import { toKharcha, type Kharcha } from '../types/models';

export interface KharchaListState {
  items: Kharcha[];
  /** True until the first network response (or failure) after mount. */
  loading: boolean;
  /** True while a user-initiated refresh is in flight. */
  refreshing: boolean;
  error: AppError | null;
  /** True when `items` came from the offline cache rather than the server. */
  fromCache: boolean;
  /** ISO timestamp of the cache snapshot currently shown, if any. */
  cachedAt: string | null;
  refresh(): Promise<void>;
}

const SHARES_REFETCH_DEBOUNCE_MS = 300;

type KharchaRow = Tables<'kharcha'>;
type KharchaSharesRow = Tables<'kharcha_shares'>;

/** expense_date desc, then created_at desc — same order `listKharcha` uses. */
export function sortKharcha(items: Kharcha[]): Kharcha[] {
  return [...items].sort((a, b) => {
    if (a.expense_date !== b.expense_date) {
      return a.expense_date < b.expense_date ? 1 : -1;
    }
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? 1 : -1;
    }
    return 0;
  });
}

export function upsertKharcha(items: Kharcha[], next: Kharcha): Kharcha[] {
  const index = items.findIndex(item => item.id === next.id);
  const merged =
    index === -1 ? [...items, next] : items.map(item => (item.id === next.id ? next : item));
  return sortKharcha(merged);
}

export function removeKharcha(items: Kharcha[], id: string): Kharcha[] {
  return items.filter(item => item.id !== id);
}

export function useKharchaList(): KharchaListState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [items, setItems] = useState<Kharcha[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const userIdRef = useRef(userId);
  const fetchSeqRef = useRef(0);
  const sharesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  /** Apply a server-confirmed list and persist it. */
  const commitItems = useCallback((uid: string, next: Kharcha[]) => {
    if (!mountedRef.current || userIdRef.current !== uid) {
      return;
    }
    setItems(next);
    setFromCache(false);
    setCachedAt(null);
    writeKharchaCache(uid, next);
  }, []);

  /** Apply a Realtime-derived change: update state, then persist it. */
  const patchItems = useCallback((uid: string, update: (prev: Kharcha[]) => Kharcha[]) => {
    if (!mountedRef.current || userIdRef.current !== uid) {
      return;
    }
    setItems(prev => {
      const next = update(prev);
      writeKharchaCache(uid, next);
      return next;
    });
  }, []);

  const fetchList = useCallback(
    async (uid: string, mode: 'initial' | 'refresh' | 'silent') => {
      const seq = ++fetchSeqRef.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      try {
        const next = await listKharcha();
        // Drop responses that raced a newer fetch or a user switch.
        if (seq !== fetchSeqRef.current) {
          return;
        }
        commitItems(uid, next);
        if (mountedRef.current && userIdRef.current === uid) {
          setError(null);
        }
      } catch (err) {
        if (seq !== fetchSeqRef.current || !mountedRef.current || userIdRef.current !== uid) {
          return;
        }
        // On a network error the cached items (if any) stay on screen and the
        // dashboard shows an offline banner; other errors are surfaced as-is.
        setError(AppError.from(err));
      } finally {
        if (mountedRef.current && userIdRef.current === uid) {
          if (mode === 'initial') {
            setLoading(false);
          }
          if (mode === 'refresh') {
            setRefreshing(false);
          }
        }
      }
    },
    [commitItems],
  );

  // Initial load: cache first, then the network.
  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      setError(null);
      setFromCache(false);
      setCachedAt(null);
      return;
    }
    const uid = userId;
    let cancelled = false;
    setItems([]);
    setLoading(true);
    setError(null);
    setFromCache(false);
    setCachedAt(null);

    (async () => {
      const cached = await readKharchaCache(uid);
      if (cancelled || !mountedRef.current) {
        return;
      }
      if (cached && cached.items.length > 0) {
        setItems(sortKharcha(cached.items));
        setFromCache(true);
        setCachedAt(cached.cachedAt);
      }
      await fetchList(uid, 'initial');
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, fetchList]);

  // Realtime: RLS is re-evaluated per subscriber, so we only receive events
  // for rows we are allowed to read (own + shared with us).
  useEffect(() => {
    if (!userId) {
      return;
    }
    const uid = userId;

    const scheduleSharesRefetch = () => {
      if (sharesTimerRef.current) {
        clearTimeout(sharesTimerRef.current);
      }
      sharesTimerRef.current = setTimeout(() => {
        sharesTimerRef.current = null;
        if (mountedRef.current && userIdRef.current === uid) {
          fetchList(uid, 'silent');
        }
      }, SHARES_REFETCH_DEBOUNCE_MS);
    };

    const onKharchaChange = (payload: RealtimePostgresChangesPayload<KharchaRow>) => {
      if (payload.eventType === 'DELETE') {
        // replica identity FULL, so `old` carries the whole row incl. id.
        const id = payload.old.id;
        if (typeof id === 'string') {
          patchItems(uid, prev => removeKharcha(prev, id));
        }
        return;
      }
      patchItems(uid, prev => upsertKharcha(prev, toKharcha(payload.new)));
    };

    const onSharesChange = (_payload: RealtimePostgresChangesPayload<KharchaSharesRow>) => {
      // A share was added/removed for us or by us; membership of the list
      // changed in a way we can't derive locally, so refetch (debounced).
      scheduleSharesRefetch();
    };

    const channel = supabase
      .channel(`kharcha:${uid}`)
      .on<KharchaRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kharcha' },
        onKharchaChange,
      )
      .on<KharchaSharesRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kharcha_shares' },
        onSharesChange,
      )
      .subscribe();

    return () => {
      if (sharesTimerRef.current) {
        clearTimeout(sharesTimerRef.current);
        sharesTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [userId, fetchList, patchItems]);

  // Refetch when the app returns to the foreground — Realtime may have been
  // disconnected while backgrounded and missed events.
  useEffect(() => {
    if (!userId) {
      return;
    }
    const uid = userId;
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active') {
        fetchList(uid, 'silent');
      }
      previous = next;
    });
    return () => {
      subscription.remove();
    };
  }, [userId, fetchList]);

  const refresh = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      return;
    }
    await fetchList(uid, 'refresh');
  }, [fetchList]);

  return { items, loading, refreshing, error, fromCache, cachedAt, refresh };
}
