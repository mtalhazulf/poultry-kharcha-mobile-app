/**
 * Biometric app lock (docs/ARCHITECTURE.md §1 and §4).
 *
 * - Cold start, or any fresh sign-in, with the preference on -> `locked`.
 * - Back from >= 60 s in the background -> `locked` again.
 * - `unlock()` shows the system prompt; cancelling keeps the app locked.
 * - Changed/removed biometrics (or a lost Keystore key) -> turn the feature
 *   off and sign out.
 * - Signing out keeps the enrollment, so signing back in on this device can
 *   offer it again; switching straight to a different signed-in account
 *   clears the previous one's secret and preference.
 *
 * While the saved preference is being read on cold start the provider paints
 * a plain background over the app so protected content never flashes before
 * the Lock screen.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import {
  clearBiometricSecret,
  enrollBiometricSecret,
  ENROLL_PROMPT,
  getBiometricCapability,
  isBiometricEnabled,
  setBiometricEnabled,
  shouldRelock,
  UNLOCK_PROMPT,
  verifyBiometric,
  type BiometricCapability,
  type BiometryLabel,
} from '../lib/biometrics';
import { AppError } from '../lib/errors';
import { colors } from '../theme';
import { useAuth } from './AuthProvider';

export const RELOCK_AFTER_MS = 60_000;

/**
 * Android delivers a picker's result before the foreground event, so the
 * suppression has to outlive the task that asked for it by a moment.
 */
const RELOCK_GRACE_MS = 1_000;

export interface BiometricLockContextValue {
  /** Device has a strong biometric enrolled. */
  available: boolean;
  biometryLabel: BiometryLabel;
  /** The signed-in user turned biometric sign-in on (on this device). */
  enabled: boolean;
  /** Show the Lock screen instead of the app. */
  locked: boolean;
  /** False while the signed-in user's preference is still loading. */
  ready: boolean;
  /** Prompts once; resolves quietly if the user cancels. Throws AppError on failure. */
  enable(): Promise<void>;
  disable(): Promise<void>;
  /** Prompts; true when unlocked. */
  unlock(): Promise<boolean>;
  /**
   * Runs `task` without the app relocking on its way back to the foreground —
   * for system UI that backgrounds the app (the camera and gallery pickers).
   * Everything the screen holds survives the trip.
   */
  suspendRelock<T>(task: () => Promise<T>): Promise<T>;
}

const BiometricLockContext = createContext<BiometricLockContextValue | undefined>(undefined);

interface Preference {
  userId: string;
  enabled: boolean;
}

const INITIAL_CAPABILITY: BiometricCapability = { available: false, type: null, label: 'Biometrics' };

export function BiometricLockProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { user, initializing, signOut } = useAuth();
  const userId = user?.id ?? null;

  const [capability, setCapability] = useState<BiometricCapability>(INITIAL_CAPABILITY);
  const [preference, setPreference] = useState<Preference | null>(null);
  const [locked, setLocked] = useState(false);

  const enabled = preference !== null && preference.userId === userId && preference.enabled;
  const ready = initializing || userId === null || preference?.userId === userId;

  // Refs let long-lived callbacks read fresh values without re-subscribing.
  const mounted = useRef(true);
  const userIdRef = useRef(userId);
  const enabledRef = useRef(enabled);
  const signOutRef = useRef(signOut);
  userIdRef.current = userId;
  enabledRef.current = enabled;
  signOutRef.current = signOut;

  const previousUserId = useRef<string | null>(null);
  const backgroundAt = useRef<number | null>(null);
  const busy = useRef(false);
  const busyGrace = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUnlock = useRef<Promise<boolean> | null>(null);
  const mustSignOut = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (busyGrace.current) {
        clearTimeout(busyGrace.current);
        busyGrace.current = null;
      }
    };
  }, []);

  const refreshCapability = useCallback(async () => {
    const next = await getBiometricCapability();
    if (mounted.current) {
      setCapability(prev =>
        prev.available === next.available && prev.label === next.label ? prev : next,
      );
    }
  }, []);

  useEffect(() => {
    refreshCapability().catch(() => undefined);
  }, [refreshCapability]);

  // Load the preference for the signed-in user; lock whenever it's on, cold
  // start or a fresh sign-in within the same running session alike.
  useEffect(() => {
    if (initializing || !userId) {
      return;
    }
    let cancelled = false;
    isBiometricEnabled(userId).then(isOn => {
      if (cancelled || !mounted.current) {
        return;
      }
      // Batched: `ready` and `locked` flip in the same render.
      setPreference({ userId, enabled: isOn });
      if (isOn) {
        setLocked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initializing, userId]);

  // Switching straight to a different signed-in account: the previous
  // account's secret must not be usable by whoever is signed in now. A
  // sign-out to null keeps the enrollment so signing back in on this device
  // can offer it again without re-enrolling.
  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (!previous || previous === userId) {
      return;
    }
    mustSignOut.current = false;
    setLocked(false);
    if (userId) {
      Promise.all([clearBiometricSecret(previous), setBiometricEnabled(previous, false)]).catch(
        err => console.warn('[biometrics] cleanup after account switch failed', err),
      );
    }
  }, [userId]);

  // Relock after a long enough trip to the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') {
        if (backgroundAt.current === null) {
          backgroundAt.current = Date.now();
        }
        return;
      }
      if (state !== 'active') {
        return;
      }
      const since = backgroundAt.current;
      backgroundAt.current = null;
      refreshCapability().catch(() => undefined);
      if (
        !busy.current &&
        userIdRef.current &&
        enabledRef.current &&
        shouldRelock(since, Date.now(), RELOCK_AFTER_MS)
      ) {
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [refreshCapability]);

  const turnOffFor = useCallback(async (uid: string) => {
    await clearBiometricSecret(uid);
    await setBiometricEnabled(uid, false);
    if (mounted.current && userIdRef.current === uid) {
      setPreference({ userId: uid, enabled: false });
    }
  }, []);

  const forceSignOut = useCallback(async () => {
    mustSignOut.current = true;
    try {
      await signOutRef.current();
    } catch (err) {
      console.warn('[biometrics] sign-out after invalidation failed', err);
    }
  }, []);

  const unlock = useCallback((): Promise<boolean> => {
    if (pendingUnlock.current) {
      return pendingUnlock.current;
    }
    const run = async (): Promise<boolean> => {
      const uid = userIdRef.current;
      if (!uid) {
        setLocked(false);
        return true;
      }
      if (mustSignOut.current) {
        // Stay locked until the invalidated session is really gone.
        await forceSignOut();
        return false;
      }
      if (!enabledRef.current) {
        setLocked(false);
        return true;
      }
      busy.current = true;
      let result;
      try {
        result = await verifyBiometric(uid, UNLOCK_PROMPT);
      } finally {
        busy.current = false;
      }
      if (!mounted.current || userIdRef.current !== uid) {
        return false;
      }
      switch (result) {
        case 'success':
          setLocked(false);
          return true;
        case 'invalidated':
        case 'unavailable':
          // Keep `locked` true: the app must not show until sign-out lands.
          await turnOffFor(uid);
          await forceSignOut();
          return false;
        default:
          return false;
      }
    };
    const promise = run().finally(() => {
      pendingUnlock.current = null;
    });
    pendingUnlock.current = promise;
    return promise;
  }, [forceSignOut, turnOffFor]);

  const enable = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      throw new AppError('auth', 'You need to be signed in to do that.');
    }
    busy.current = true;
    let result;
    try {
      result = await enrollBiometricSecret(uid, ENROLL_PROMPT);
    } finally {
      busy.current = false;
    }
    if (result === 'cancelled') {
      return;
    }
    if (result === 'unavailable' || result === 'invalidated') {
      refreshCapability().catch(() => undefined);
      throw new AppError(
        'validation',
        'Set up a fingerprint or face unlock in your phone settings, then try again.',
      );
    }
    if (result !== 'success') {
      throw new AppError('unknown', 'Could not turn on biometric sign-in. Try again.');
    }
    await setBiometricEnabled(uid, true);
    if (mounted.current && userIdRef.current === uid) {
      setPreference({ userId: uid, enabled: true });
    }
  }, [refreshCapability]);

  const suspendRelock = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    if (busyGrace.current) {
      clearTimeout(busyGrace.current);
      busyGrace.current = null;
    }
    busy.current = true;
    try {
      return await task();
    } finally {
      busyGrace.current = setTimeout(() => {
        busyGrace.current = null;
        busy.current = false;
      }, RELOCK_GRACE_MS);
    }
  }, []);

  const disable = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      return;
    }
    await turnOffFor(uid);
  }, [turnOffFor]);

  const value = useMemo<BiometricLockContextValue>(
    () => ({
      available: capability.available,
      biometryLabel: capability.label,
      enabled,
      locked: locked && userId !== null,
      ready,
      enable,
      disable,
      unlock,
      suspendRelock,
    }),
    [capability, enabled, locked, userId, ready, enable, disable, unlock, suspendRelock],
  );

  return (
    <BiometricLockContext.Provider value={value}>
      {children}
      {ready ? null : (
        <View
          style={styles.cover}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </BiometricLockContext.Provider>
  );
}

export function useBiometricLock(): BiometricLockContextValue {
  const ctx = useContext(BiometricLockContext);
  if (!ctx) {
    throw new Error('useBiometricLock must be used inside <BiometricLockProvider>.');
  }
  return ctx;
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
});
