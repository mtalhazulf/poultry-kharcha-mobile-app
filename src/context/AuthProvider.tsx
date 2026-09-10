import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking } from 'react-native';
import { ensureMyProfile, getMyProfile } from '../api/profiles';
import {
  configureGoogleSignIn,
  handleAuthDeepLink,
  signInWithGoogle as signInWithGoogleImpl,
  signInWithPassword as signInWithPasswordImpl,
  signOut as signOutImpl,
  signUpWithPassword as signUpWithPasswordImpl,
} from '../lib/auth';
import { AppError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/models';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True until the persisted session has been read from AsyncStorage. */
  initializing: boolean;
  /** Error raised while completing a browser OAuth deep link, if any. */
  lastAuthError: AppError | null;
  clearAuthError(): void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUpWithPassword(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [lastAuthError, setLastAuthError] = useState<AppError | null>(null);
  const mounted = useRef(true);

  const userId = session?.user.id ?? null;

  // Session bootstrap + live updates.
  useEffect(() => {
    mounted.current = true;
    configureGoogleSignIn();

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted.current) {
          return;
        }
        if (error) {
          console.warn('Failed to read persisted session', error);
        }
        setSession(data.session);
      })
      .catch(err => console.warn('Failed to read persisted session', err))
      .finally(() => {
        if (mounted.current) {
          setInitializing(false);
        }
      });

    // Keep this callback synchronous: awaiting other Supabase calls inside it
    // deadlocks the auth client's internal lock. Profile loading is a
    // separate effect keyed on the user id.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
      }
    });

    return () => {
      mounted.current = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Profile follows the signed-in user.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await ensureMyProfile();
        const next = await getMyProfile();
        if (!cancelled) {
          setProfile(next);
        }
      } catch (err) {
        console.warn('Could not load profile', AppError.from(err).message);
        if (!cancelled) {
          setProfile(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Browser OAuth callbacks arrive as deep links.
  useEffect(() => {
    let cancelled = false;
    const handle = (url: string | null | undefined) => {
      if (!url || cancelled) {
        return;
      }
      handleAuthDeepLink(url)
        .then(consumed => {
          if (consumed && !cancelled) {
            setLastAuthError(null);
          }
        })
        .catch(err => {
          if (!cancelled) {
            setLastAuthError(AppError.from(err));
          }
        });
    };

    Linking.getInitialURL()
      .then(handle)
      .catch(err => console.warn('Could not read initial URL', err));
    const listener = Linking.addEventListener('url', ({ url }) => handle(url));

    return () => {
      cancelled = true;
      listener.remove();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const next = await getMyProfile();
    if (mounted.current) {
      setProfile(next);
    }
  }, [userId]);

  const clearAuthError = useCallback(() => setLastAuthError(null), []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setLastAuthError(null);
    await signInWithPasswordImpl(email, password);
  }, []);

  const signUpWithPassword = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setLastAuthError(null);
      return signUpWithPasswordImpl(email, password, displayName);
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    setLastAuthError(null);
    await signInWithGoogleImpl();
  }, []);

  const signOut = useCallback(async () => {
    await signOutImpl();
    if (mounted.current) {
      setSession(null);
      setProfile(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      lastAuthError,
      clearAuthError,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      initializing,
      lastAuthError,
      clearAuthError,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}
