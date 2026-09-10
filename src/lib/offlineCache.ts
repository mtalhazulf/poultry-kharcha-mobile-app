/**
 * AsyncStorage-backed snapshot of the last expense list, so the dashboard has
 * something to show while offline. Every function swallows storage failures:
 * a broken cache must never take the app down, it just means a cold start.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Kharcha } from '../types/models';

export interface KharchaCache {
  items: Kharcha[];
  /** ISO timestamp of when the snapshot was written. */
  cachedAt: string;
}

const KEY_PREFIX = 'kharcha:list:v1:';

export function kharchaCacheKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Minimal shape check: every item must be an object with a string `id`. */
function isKharchaArray(value: unknown): value is Kharcha[] {
  return Array.isArray(value) && value.every(item => isRecord(item) && typeof item.id === 'string');
}

function parseCache(raw: string): KharchaCache | null {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    return null;
  }
  const { items, cachedAt } = parsed;
  if (!isKharchaArray(items) || typeof cachedAt !== 'string') {
    return null;
  }
  return { items, cachedAt };
}

export async function readKharchaCache(userId: string): Promise<KharchaCache | null> {
  try {
    const raw = await AsyncStorage.getItem(kharchaCacheKey(userId));
    if (raw === null) {
      return null;
    }
    return parseCache(raw);
  } catch {
    return null;
  }
}

export async function writeKharchaCache(userId: string, items: Kharcha[]): Promise<void> {
  try {
    const snapshot: KharchaCache = {
      items,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(kharchaCacheKey(userId), JSON.stringify(snapshot));
  } catch {
    // Best-effort: a failed write only costs us the offline fallback.
  }
}

export async function clearKharchaCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(kharchaCacheKey(userId));
  } catch {
    // Ignore — nothing sensitive is lost by leaving a stale snapshot behind.
  }
}
