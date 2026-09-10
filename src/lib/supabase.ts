import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '../types/database';
import { env } from './env';
import { AppError } from './errors';

export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No browser URL to inspect in React Native; OAuth callbacks are handled
    // explicitly through deep links (see lib/auth).
    detectSessionInUrl: false,
    // PKCE: the browser OAuth redirect carries a one-time `code`, never tokens.
    flowType: 'pkce',
  },
});

// Only refresh tokens while the app is foregrounded; Supabase's timer would
// otherwise keep firing in the background.
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

/** Resolve the signed-in user's id or throw an auth error. */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw AppError.from(error);
  }
  const id = data.session?.user.id;
  if (!id) {
    throw new AppError('auth', 'You need to be signed in to do that.');
  }
  return id;
}
