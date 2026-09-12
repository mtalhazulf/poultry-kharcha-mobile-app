/**
 * AsyncStorage snapshots so the app has something to show while offline:
 * expenses (per user and organization), expense types (per organization)
 * and the signed-in person's memberships. Every function swallows storage
 * failures: a broken cache only costs a cold start, never a crash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isMemberStatus,
  isOrgRole,
  type Category,
  type KharchaWithOwner,
  type Membership,
} from '../types/models';

const KHARCHA_PREFIX = 'mps:kharcha:v2:';
const CATEGORIES_PREFIX = 'mps:categories:v2:';
const MEMBERSHIPS_PREFIX = 'mps:memberships:v1:';
// Written by the single-tenant builds; removed on sign-out.
const LEGACY_KHARCHA_PREFIX = 'kharcha:list:v1:';
const LEGACY_CATEGORIES_KEY = 'kharcha:categories:v1';

export interface KharchaCache {
  items: KharchaWithOwner[];
  /** ISO timestamp of when the snapshot was written. */
  cachedAt: string;
}

export function kharchaCacheKey(userId: string, orgId: string): string {
  return `${KHARCHA_PREFIX}${userId}:${orgId}`;
}

export function categoriesCacheKey(orgId: string): string {
  return `${CATEGORIES_PREFIX}${orgId}`;
}

export function membershipsCacheKey(userId: string): string {
  return `${MEMBERSHIPS_PREFIX}${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort: a failed write only costs the offline fallback.
  }
}

async function removeMatchingKeys(matches: (key: string) => boolean): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(matches);
    if (keys.length > 0) {
      await AsyncStorage.removeMany(keys);
    }
  } catch {
    // Ignore: a stale snapshot is overwritten by the next successful load.
  }
}

// --- Expenses ---------------------------------------------------------------

export async function readKharchaCache(
  userId: string,
  orgId: string,
): Promise<KharchaCache | null> {
  const parsed = await readJson(kharchaCacheKey(userId, orgId));
  if (!isRecord(parsed)) {
    return null;
  }
  const { items, cachedAt } = parsed;
  if (
    !Array.isArray(items) ||
    typeof cachedAt !== 'string' ||
    !items.every(item => isRecord(item) && typeof item.id === 'string' && item.org_id === orgId)
  ) {
    return null;
  }
  return { items: items as KharchaWithOwner[], cachedAt };
}

export async function writeKharchaCache(
  userId: string,
  orgId: string,
  items: KharchaWithOwner[],
): Promise<void> {
  const snapshot: KharchaCache = { items, cachedAt: new Date().toISOString() };
  await writeJson(kharchaCacheKey(userId, orgId), snapshot);
}

/** Drops every expense snapshot of this user (all organizations, plus the legacy key). */
export async function clearKharchaCache(userId: string): Promise<void> {
  await removeMatchingKeys(
    key =>
      key.startsWith(`${KHARCHA_PREFIX}${userId}:`) || key === `${LEGACY_KHARCHA_PREFIX}${userId}`,
  );
}

// --- Expense types ----------------------------------------------------------

export async function readCategoriesCache(orgId: string): Promise<Category[] | null> {
  const parsed = await readJson(categoriesCacheKey(orgId));
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      item =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.icon === 'string' &&
        item.org_id === orgId,
    )
  ) {
    return null;
  }
  return parsed as Category[];
}

export async function writeCategoriesCache(orgId: string, items: Category[]): Promise<void> {
  await writeJson(categoriesCacheKey(orgId), items);
}

// --- Memberships ------------------------------------------------------------

function isCachedMembership(value: unknown, userId: string): boolean {
  if (!isRecord(value) || !isRecord(value.organization)) {
    return false;
  }
  const { org_id, user_id, role, status, organization } = value;
  return (
    typeof org_id === 'string' &&
    user_id === userId &&
    typeof role === 'string' &&
    isOrgRole(role) &&
    typeof status === 'string' &&
    isMemberStatus(status) &&
    typeof organization.id === 'string' &&
    typeof organization.name === 'string'
  );
}

export async function readMembershipsCache(userId: string): Promise<Membership[] | null> {
  const parsed = await readJson(membershipsCacheKey(userId));
  if (!Array.isArray(parsed) || !parsed.every(item => isCachedMembership(item, userId))) {
    return null;
  }
  return parsed as Membership[];
}

export async function writeMembershipsCache(userId: string, items: Membership[]): Promise<void> {
  await writeJson(membershipsCacheKey(userId), items);
}

/** Everything cached for this user on the device (plus shared expense-type snapshots). Call on sign-out. */
export async function clearUserCaches(userId: string): Promise<void> {
  await removeMatchingKeys(
    key =>
      key.startsWith(`${KHARCHA_PREFIX}${userId}:`) ||
      key === membershipsCacheKey(userId) ||
      key.startsWith(CATEGORIES_PREFIX) ||
      key === `${LEGACY_KHARCHA_PREFIX}${userId}` ||
      key === LEGACY_CATEGORIES_KEY,
  );
}
