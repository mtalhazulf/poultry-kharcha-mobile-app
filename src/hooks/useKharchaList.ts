/**
 * Expense list of one organization: cache-first load (per user and
 * organization), network refresh, Supabase Realtime for live updates, and a
 * refetch whenever the app returns to the foreground. Everything is keyed by
 * user + organization; responses for a previous organization are dropped.
 *
 * Access control lives in RLS: every active member receives the whole
 * organization — from `listKharcha` and from Realtime alike, since Realtime
 * re-checks RLS per subscriber.
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
import { toKharcha, type Kharcha, type KharchaWithOwner } from '../types/models';

export interface KharchaListState {
  items: KharchaWithOwner[];
  /** True until the first network response (or failure) for this organization. */
  loading: boolean;
  /** True while a user-initiated refresh is in flight. */
  refreshing: boolean;
  error: AppError | null;
  /** True when `items` came from the offline cache rather than the server. */
  fromCache: boolean;
  /** ISO timestamp of the cache snapshot currently shown, if any. */
  cachedAt: string | null;
  refresh(): Promise<void>;
  /** Refetch without touching `refreshing` — for focus/foreground revalidation. */
  revalidate(): Promise<void>;
}

const REFETCH_DEBOUNCE_MS = 300;

type KharchaRow = Tables<'kharcha'>;

interface Scope {
  userId: string;
  orgId: string;
  key: string;
}

function scopeFor(userId: string, orgId: string): Scope {
  return { userId, orgId, key: `${userId}:${orgId}` };
}

// realtime-js hands back the existing channel when a topic is reused, so every
// hook instance gets its own topic: `kharcha:<orgId>:<n>`.
let channelCounter = 0;

/**
 * Newest touched first — `updated_at` desc, the order `listKharcha` uses.
 * A freshly created row's `updated_at` starts equal to `created_at` (set once
 * at insert, then bumped by the `kharcha_set_updated_at` trigger on every
 * edit), so an unedited expense sorts by when it was added; editing one
 * (even a backdated `expense_date`) brings it back to the top.
 */
export function sortKharcha<T extends Kharcha>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.updated_at !== b.updated_at) {
      return a.updated_at < b.updated_at ? 1 : -1;
    }
    return 0;
  });
}

export function upsertKharcha<T extends Kharcha>(items: T[], next: T): T[] {
  const index = items.findIndex(item => item.id === next.id);
  const merged =
    index === -1 ? [...items, next] : items.map(item => (item.id === next.id ? next : item));
  return sortKharcha(merged);
}

export function removeKharcha<T extends Kharcha>(items: T[], id: string): T[] {
  return items.filter(item => item.id !== id);
}

export function useKharchaList(orgId: string | null): KharchaListState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [items, setItems] = useState<KharchaWithOwner[]>([]);
  const [loading, setLoading] = useState(userId !== null && orgId !== null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const scopeRef = useRef<Scope | null>(null);
  const itemsRef = useRef<KharchaWithOwner[]>([]);
  const fetchSeqRef = useRef(0);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isCurrentScope = useCallback(
    (scope: Scope) => mountedRef.current && scopeRef.current?.key === scope.key,
    [],
  );

  const applyItems = useCallback((next: KharchaWithOwner[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  /** Apply a server-confirmed list and persist it. */
  const commitItems = useCallback(
    (scope: Scope, next: KharchaWithOwner[]) => {
      if (!isCurrentScope(scope)) {
        return;
      }
      applyItems(next);
      setFromCache(false);
      setCachedAt(null);
      writeKharchaCache(scope.userId, scope.orgId, next);
    },
    [applyItems, isCurrentScope],
  );

  /** Apply a Realtime-derived change, then persist it. */
  const patchItems = useCallback(
    (scope: Scope, update: (prev: KharchaWithOwner[]) => KharchaWithOwner[]) => {
      if (!isCurrentScope(scope)) {
        return;
      }
      const next = update(itemsRef.current);
      applyItems(next);
      writeKharchaCache(scope.userId, scope.orgId, next);
    },
    [applyItems, isCurrentScope],
  );

  const fetchList = useCallback(
    async (scope: Scope, mode: 'initial' | 'refresh' | 'silent') => {
      const seq = ++fetchSeqRef.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      try {
        const next = await listKharcha(scope.orgId);
        // Drop responses that raced a newer fetch or an organization/user switch.
        if (seq !== fetchSeqRef.current) {
          return;
        }
        commitItems(scope, next);
        if (isCurrentScope(scope)) {
          setError(null);
        }
      } catch (err) {
        if (seq !== fetchSeqRef.current || !isCurrentScope(scope)) {
          return;
        }
        // On a network error cached items (if any) stay on screen.
        setError(AppError.from(err));
      } finally {
        if (isCurrentScope(scope)) {
          if (seq === fetchSeqRef.current) {
            setLoading(false);
          }
          if (mode === 'refresh') {
            setRefreshing(false);
          }
        }
      }
    },
    [commitItems, isCurrentScope],
  );

  // Initial load for this user + organization: cache first, then the network.
  useEffect(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = null;
    }
    fetchSeqRef.current += 1;
    applyItems([]);
    setError(null);
    setFromCache(false);
    setCachedAt(null);
    setRefreshing(false);
    if (!userId || !orgId) {
      scopeRef.current = null;
      setLoading(false);
      return;
    }
    const scope = scopeFor(userId, orgId);
    scopeRef.current = scope;
    setLoading(true);
    const startSeq = fetchSeqRef.current;
    let cancelled = false;

    (async () => {
      const cached = await readKharchaCache(scope.userId, scope.orgId);
      if (cancelled || !isCurrentScope(scope)) {
        return;
      }
      // Paint the snapshot only if no fetch has started meanwhile.
      if (cached && cached.items.length > 0 && fetchSeqRef.current === startSeq) {
        applyItems(sortKharcha(cached.items));
        setFromCache(true);
        setCachedAt(cached.cachedAt);
      }
      await fetchList(scope, 'initial');
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, orgId, applyItems, fetchList, isCurrentScope]);

  // Realtime for this organization. Events carry only the row, so the owner
  // profile is reused from the list or fetched with a debounced refetch.
  useEffect(() => {
    if (!userId || !orgId) {
      return;
    }
    const scope = scopeFor(userId, orgId);

    const scheduleRefetch = () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        if (isCurrentScope(scope)) {
          fetchList(scope, 'silent');
        }
      }, REFETCH_DEBOUNCE_MS);
    };

    const onUpsert = (payload: RealtimePostgresChangesPayload<KharchaRow>) => {
      if (payload.eventType === 'DELETE' || payload.new.org_id !== orgId) {
        return;
      }
      const base = toKharcha(payload.new);
      const current = itemsRef.current;
      const owner =
        current.find(item => item.id === base.id)?.owner ??
        current.find(item => item.owner_id === base.owner_id)?.owner ??
        null;
      patchItems(scope, prev => upsertKharcha(prev, { ...base, owner }));
      if (!owner) {
        scheduleRefetch();
      }
    };

    const onDelete = (payload: RealtimePostgresChangesPayload<KharchaRow>) => {
      if (payload.eventType !== 'DELETE') {
        return;
      }
      // Replica identity is DEFAULT on purpose (primary key only): Realtime
      // cannot apply RLS to DELETE events, so `old` must not carry row data.
      const id = payload.old.id;
      if (typeof id === 'string') {
        patchItems(scope, prev => removeKharcha(prev, id));
      }
    };

    const filter = `org_id=eq.${orgId}`;
    channelCounter += 1;
    const channel = supabase
      .channel(`kharcha:${orgId}:${channelCounter}`)
      .on<KharchaRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'kharcha', filter },
        onUpsert,
      )
      .on<KharchaRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kharcha', filter },
        onUpsert,
      )
      // Realtime cannot filter DELETE events; ids not in this list are ignored.
      .on<KharchaRow>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'kharcha' },
        onDelete,
      )
      .subscribe();

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [userId, orgId, fetchList, patchItems, isCurrentScope]);

  // Realtime may have missed events while the app was in the background.
  useEffect(() => {
    if (!userId || !orgId) {
      return;
    }
    const scope = scopeFor(userId, orgId);
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active' && isCurrentScope(scope)) {
        fetchList(scope, 'silent');
      }
      previous = next;
    });
    return () => {
      subscription.remove();
    };
  }, [userId, orgId, fetchList, isCurrentScope]);

  const refresh = useCallback(async () => {
    const scope = scopeRef.current;
    if (scope) {
      await fetchList(scope, 'refresh');
    }
  }, [fetchList]);

  const revalidate = useCallback(async () => {
    const scope = scopeRef.current;
    if (scope) {
      await fetchList(scope, 'silent');
    }
  }, [fetchList]);

  return { items, loading, refreshing, error, fromCache, cachedAt, refresh, revalidate };
}
