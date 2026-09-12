/**
 * Expense types of one organization, for pickers, filters and the admin
 * list. Cache-first per organization so the expense form works offline;
 * refetched whenever the organization changes and on demand. Results that
 * arrive after the organization changed are dropped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listCategories } from '../api/categories';
import { AppError } from '../lib/errors';
import { readCategoriesCache, writeCategoriesCache } from '../lib/offlineCache';
import { DEFAULT_CATEGORIES, type Category } from '../types/models';

export interface CategoriesState {
  categories: Category[];
  loading: boolean;
  error: AppError | null;
  /** True while showing a cached copy or the built-in defaults instead of server data. */
  fromCache: boolean;
  refresh(): Promise<void>;
}

/** Built-in defaults, shown only when offline with nothing cached. Ids start with `default-`. */
export function defaultCategoriesFor(orgId: string): Category[] {
  return DEFAULT_CATEGORIES.map((category, index) => ({
    id: `default-${category.name.toLowerCase()}`,
    org_id: orgId,
    name: category.name,
    icon: category.icon,
    sort_order: (index + 1) * 10,
    active: true,
    created_at: '',
  }));
}

export function useCategories(
  orgId: string | null,
  opts: { includeInactive?: boolean } = {},
): CategoriesState {
  const includeInactive = opts.includeInactive ?? false;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(orgId !== null);
  const [error, setError] = useState<AppError | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const mountedRef = useRef(true);
  const orgRef = useRef(orgId);
  const seqRef = useRef(0);
  const hasDataRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const apply = useCallback((next: Category[], cached: boolean) => {
    hasDataRef.current = next.length > 0;
    setCategories(next);
    setFromCache(cached);
  }, []);

  const load = useCallback(
    async (targetOrg: string) => {
      const seq = ++seqRef.current;
      const isCurrent = () =>
        mountedRef.current && seq === seqRef.current && orgRef.current === targetOrg;
      try {
        const next = await listCategories(targetOrg, { includeInactive });
        if (!isCurrent()) {
          return;
        }
        apply(next, false);
        setError(null);
        if (!includeInactive) {
          writeCategoriesCache(targetOrg, next);
        }
      } catch (err) {
        if (!isCurrent()) {
          return;
        }
        const appErr = AppError.from(err);
        setError(appErr);
        // Offline with nothing on screen: the defaults keep the expense form usable.
        if (!includeInactive && appErr.kind === 'network' && !hasDataRef.current) {
          apply(defaultCategoriesFor(targetOrg), true);
        }
      } finally {
        if (isCurrent()) {
          setLoading(false);
        }
      }
    },
    [apply, includeInactive],
  );

  useEffect(() => {
    orgRef.current = orgId;
    // Invalidate anything still in flight for the previous organization.
    const startSeq = ++seqRef.current;
    apply([], false);
    setError(null);
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    (async () => {
      if (!includeInactive) {
        const cached = await readCategoriesCache(orgId);
        // A refresh() that started meanwhile owns the result; don't paint the cache over it.
        if (cancelled || seqRef.current !== startSeq) {
          return;
        }
        if (cached && cached.length > 0) {
          apply(cached, true);
        }
      }
      if (!cancelled) {
        await load(orgId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, includeInactive, apply, load]);

  const refresh = useCallback(async () => {
    const target = orgRef.current;
    if (target) {
      await load(target);
    }
  }, [load]);

  return { categories, loading, error, fromCache, refresh };
}
