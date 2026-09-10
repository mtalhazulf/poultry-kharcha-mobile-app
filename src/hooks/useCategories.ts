/**
 * The org's expense types for pickers and filters. Cache-first so the form
 * works offline; refreshed from the server on mount and on demand.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listCategories } from '../api/categories';
import { AppError } from '../lib/errors';
import { DEFAULT_CATEGORIES, type Category } from '../types/models';

const CACHE_KEY = 'kharcha:categories:v1';

const FALLBACK: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
  id: `default-${c.name}`,
  name: c.name,
  emoji: c.emoji,
  sort_order: (i + 1) * 10,
  active: true,
  created_at: '',
}));

async function readCache(): Promise<Category[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) &&
      parsed.every(
        c => typeof c === 'object' && c !== null && typeof (c as Category).name === 'string',
      )
      ? (parsed as Category[])
      : null;
  } catch {
    return null;
  }
}

async function writeCache(items: Category[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // best effort
  }
}

export interface CategoriesState {
  categories: Category[];
  loading: boolean;
  error: AppError | null;
  /** True while showing the built-in defaults or a cached copy. */
  fromCache: boolean;
  refresh(): Promise<void>;
}

export function useCategories(options: { includeInactive?: boolean } = {}): CategoriesState {
  const { includeInactive = false } = options;
  const [categories, setCategories] = useState<Category[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fromCache, setFromCache] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await listCategories({ includeInactive });
      if (!mounted.current) {
        return;
      }
      setCategories(next.length > 0 ? next : FALLBACK);
      setFromCache(false);
      setError(null);
      if (!includeInactive) {
        writeCache(next);
      }
    } catch (err) {
      if (mounted.current) {
        setError(AppError.from(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [includeInactive]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!includeInactive) {
        const cached = await readCache();
        if (!cancelled && cached && cached.length > 0) {
          setCategories(cached);
        }
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, includeInactive]);

  return { categories, loading, error, fromCache, refresh };
}
