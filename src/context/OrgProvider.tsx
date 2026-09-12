/**
 * The signed-in person's organizations and which one is active. The active
 * organization id is remembered per user on the device
 * (`mps:active-org:v1:<userId>`); when it is missing or no longer active the
 * first active membership (by name) is used. Memberships are cached so the
 * app can open offline, and refetched whenever the app returns to the
 * foreground.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  compareMemberships,
  createOrganization,
  listMyMemberships,
  requestToJoin,
  type JoinRequestResult,
} from '../api/organizations';
import { AppError } from '../lib/errors';
import { readMembershipsCache, writeMembershipsCache } from '../lib/offlineCache';
import type { Membership, Organization, OrgRole } from '../types/models';
import { useAuth } from './AuthProvider';

export interface OrgContextValue {
  /** Every membership: active, pending and disabled. */
  memberships: Membership[];
  activeMemberships: Membership[];
  /** Join requests still waiting for approval. */
  pendingMemberships: Membership[];
  activeOrg: Organization | null;
  role: OrgRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  /** True until memberships are known for the signed-in user (server or offline cache). */
  loading: boolean;
  error: AppError | null;
  /** Only an active membership can be selected. */
  switchOrg(orgId: string): Promise<void>;
  refresh(): Promise<void>;
  /** Creates an organization and makes it the active one. */
  createOrg(name: string): Promise<Organization>;
  /** Sends a join request (usually `pending`) and refreshes memberships. */
  joinWithCode(code: string): Promise<JoinRequestResult>;
}

export function activeOrgStorageKey(userId: string): string {
  return `mps:active-org:v1:${userId}`;
}

/** The preferred organization when it is an active membership, else the first active one. */
export function pickActiveMembership(
  memberships: Membership[],
  preferredOrgId: string | null,
): Membership | null {
  const active = memberships.filter(m => m.status === 'active');
  return active.find(m => m.org_id === preferredOrgId) ?? active[0] ?? null;
}

async function readActiveOrgId(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(activeOrgStorageKey(userId));
  } catch {
    return null;
  }
}

async function writeActiveOrgId(userId: string, orgId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(activeOrgStorageKey(userId), orgId);
  } catch {
    // Best effort: the choice still applies for this session.
  }
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

export function OrgProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [preferredOrgId, setPreferredOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(userId !== null);
  const [error, setError] = useState<AppError | null>(null);

  const mountedRef = useRef(true);
  const userRef = useRef(userId);
  const seqRef = useRef(0);
  const membershipsRef = useRef<Membership[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyMemberships = useCallback((next: Membership[]) => {
    membershipsRef.current = next;
    setMemberships(next);
  }, []);

  /** Fetches memberships for `uid`. Responses that raced a newer fetch or a user switch are dropped. */
  const load = useCallback(
    async (uid: string): Promise<void> => {
      const seq = ++seqRef.current;
      const isCurrent = () =>
        mountedRef.current && userRef.current === uid && seq === seqRef.current;
      try {
        const next = await listMyMemberships();
        if (!isCurrent()) {
          return;
        }
        applyMemberships(next);
        setError(null);
        writeMembershipsCache(uid, next);
      } catch (err) {
        if (isCurrent()) {
          setError(AppError.from(err));
        }
      } finally {
        if (isCurrent()) {
          setLoading(false);
        }
      }
    },
    [applyMemberships],
  );

  // Memberships follow the signed-in user: cache first, then the server.
  useEffect(() => {
    userRef.current = userId;
    seqRef.current += 1;
    applyMemberships([]);
    setPreferredOrgId(null);
    setError(null);
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    (async () => {
      const [storedOrgId, cached] = await Promise.all([
        readActiveOrgId(userId),
        readMembershipsCache(userId),
      ]);
      if (cancelled || userRef.current !== userId) {
        return;
      }
      setPreferredOrgId(prev => prev ?? storedOrgId);
      if (cached && cached.length > 0 && membershipsRef.current.length === 0) {
        applyMemberships(cached);
        setLoading(false);
      }
      await load(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, applyMemberships, load]);

  // Approvals, removals and role changes happen elsewhere: recheck on foreground.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active') {
        load(userId);
      }
      previous = next;
    });
    return () => {
      subscription.remove();
    };
  }, [userId, load]);

  const refresh = useCallback(async () => {
    const uid = userRef.current;
    if (uid) {
      await load(uid);
    }
  }, [load]);

  const switchOrg = useCallback(async (orgId: string) => {
    const uid = userRef.current;
    if (!uid) {
      throw new AppError('auth', 'You need to be signed in to do that.');
    }
    if (!membershipsRef.current.some(m => m.org_id === orgId && m.status === 'active')) {
      throw new AppError('permission', 'Your access to that organization is not active.');
    }
    setPreferredOrgId(orgId);
    await writeActiveOrgId(uid, orgId);
  }, []);

  const createOrg = useCallback(
    async (name: string) => {
      const uid = userRef.current;
      if (!uid) {
        throw new AppError('auth', 'You need to be signed in to do that.');
      }
      const org = await createOrganization(name);
      if (userRef.current !== uid) {
        return org;
      }
      setPreferredOrgId(org.id);
      await writeActiveOrgId(uid, org.id);
      await load(uid);
      if (userRef.current === uid && !membershipsRef.current.some(m => m.org_id === org.id)) {
        // The refresh failed (e.g. the connection dropped right after creating): show it anyway.
        const now = new Date().toISOString();
        applyMemberships(
          [
            ...membershipsRef.current,
            {
              org_id: org.id,
              user_id: uid,
              role: 'owner' as const,
              status: 'active' as const,
              requested_at: now,
              approved_at: now,
              organization: org,
            },
          ].sort(compareMemberships),
        );
      }
      return org;
    },
    [applyMemberships, load],
  );

  const joinWithCode = useCallback(
    async (code: string) => {
      const uid = userRef.current;
      if (!uid) {
        throw new AppError('auth', 'You need to be signed in to do that.');
      }
      const result = await requestToJoin(code);
      if (userRef.current === uid) {
        await load(uid);
      }
      return result;
    },
    [load],
  );

  const activeMemberships = useMemo(
    () => memberships.filter(m => m.status === 'active'),
    [memberships],
  );
  const pendingMemberships = useMemo(
    () => memberships.filter(m => m.status === 'pending'),
    [memberships],
  );
  const activeMembership = useMemo(
    () => pickActiveMembership(memberships, preferredOrgId),
    [memberships, preferredOrgId],
  );
  const role = activeMembership?.role ?? null;

  const value = useMemo<OrgContextValue>(
    () => ({
      memberships,
      activeMemberships,
      pendingMemberships,
      activeOrg: activeMembership?.organization ?? null,
      role,
      isAdmin: role === 'owner' || role === 'admin',
      isOwner: role === 'owner',
      loading,
      error,
      switchOrg,
      refresh,
      createOrg,
      joinWithCode,
    }),
    [
      memberships,
      activeMemberships,
      pendingMemberships,
      activeMembership,
      role,
      loading,
      error,
      switchOrg,
      refresh,
      createOrg,
      joinWithCode,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error('useOrg must be used inside <OrgProvider>.');
  }
  return ctx;
}
