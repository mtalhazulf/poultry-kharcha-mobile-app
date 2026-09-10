/**
 * Auth helpers on top of the Supabase client. Screens never touch
 * `supabase.auth` directly; they go through `AuthProvider`, which calls these.
 */
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Linking } from 'react-native';
import { env } from './env';
import { AppError } from './errors';
import { supabase } from './supabase';

let googleConfigured = false;

/** True when native Google Sign-In can be used (a web client id was baked in). */
export function isGoogleSignInConfigured(): boolean {
  return env.GOOGLE_WEB_CLIENT_ID.length > 0;
}

/** Idempotent; safe to call from every mount of the provider. */
export function configureGoogleSignIn(): void {
  if (googleConfigured || !isGoogleSignInConfigured()) {
    return;
  }
  GoogleSignin.configure({ webClientId: env.GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
  googleConfigured = true;
}

async function signInWithGoogleNative(): Promise<void> {
  configureGoogleSignIn();
  let idToken: string | null = null;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) {
      // User dismissed the account picker.
      return;
    }
    idToken = res.data.idToken;
  } catch (err) {
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return;
        case statusCodes.IN_PROGRESS:
          throw new AppError('auth', 'Google sign-in is already in progress.', err);
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new AppError(
            'auth',
            'Google Play Services are missing or out of date on this device.',
            err,
          );
        default:
          throw new AppError('auth', 'Google sign-in failed. Please try again.', err);
      }
    }
    throw AppError.from(err);
  }
  if (!idToken) {
    throw new AppError(
      'auth',
      'Google did not return an ID token. Check the GOOGLE_WEB_CLIENT_ID configuration.',
    );
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) {
    throw AppError.from(error);
  }
}

/**
 * Browser-based OAuth (PKCE). The redirect lands back in the app as a deep
 * link, which `handleAuthDeepLink` turns into a session.
 */
async function signInWithGoogleBrowser(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: env.OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) {
    throw AppError.from(error);
  }
  if (!data.url) {
    throw new AppError('auth', 'Could not start Google sign-in. Please try again.');
  }
  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) {
    throw new AppError('auth', 'No browser is available to complete Google sign-in.');
  }
  await Linking.openURL(data.url);
}

/**
 * Native Google Sign-In when a web client id is configured; otherwise the
 * browser OAuth flow. Resolves without a session when the user cancels.
 */
export async function signInWithGoogle(): Promise<void> {
  if (isGoogleSignInConfigured()) {
    await signInWithGoogleNative();
  } else {
    await signInWithGoogleBrowser();
  }
}

function isAuthCallbackUrl(url: string): boolean {
  const redirect = env.OAUTH_REDIRECT_URL.toLowerCase();
  const lower = url.toLowerCase();
  if (!lower.startsWith(redirect)) {
    return false;
  }
  // "kharcha://auth/callback?x" / "#x" / exact match, but not "kharcha://auth/callbackfoo".
  const rest = lower.slice(redirect.length);
  return rest === '' || rest.startsWith('?') || rest.startsWith('#') || rest.startsWith('/');
}

/**
 * Completes a browser OAuth round-trip. Returns `true` when `url` was an auth
 * callback (whether or not it succeeded — failures throw), `false` when the
 * URL is unrelated and should be handled elsewhere (e.g. by navigation).
 */
export async function handleAuthDeepLink(url: string): Promise<boolean> {
  if (!isAuthCallbackUrl(url)) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new AppError('auth', 'Received a malformed sign-in callback.', err);
  }
  const query = parsed.searchParams;
  const hash = new URLSearchParams(
    parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash,
  );

  const errorDescription = query.get('error_description') ?? hash.get('error_description');
  const errorCode = query.get('error') ?? hash.get('error');
  if (errorDescription || errorCode) {
    throw new AppError(
      'auth',
      (errorDescription ?? errorCode ?? 'Sign-in failed.').replace(/\+/g, ' '),
    );
  }

  // PKCE (the configured flow): a one-time code we exchange server-side.
  const code = query.get('code') ?? hash.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw AppError.from(error);
    }
    return true;
  }

  // Implicit fallback: tokens arrive in the fragment.
  const accessToken = hash.get('access_token') ?? query.get('access_token');
  const refreshToken = hash.get('refresh_token') ?? query.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw AppError.from(error);
    }
    return true;
  }

  throw new AppError('auth', 'The sign-in callback did not contain a session.');
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    throw AppError.from(error);
  }
}

/**
 * `display_name` goes into `raw_user_meta_data`, which the `handle_new_user`
 * trigger copies onto the profile row.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ needsEmailConfirmation: boolean }> {
  const name = displayName?.trim();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: env.OAUTH_REDIRECT_URL,
      data: name ? { display_name: name } : {},
    },
  });
  if (error) {
    throw AppError.from(error);
  }
  return { needsEmailConfirmation: data.session === null };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (isGoogleSignInConfigured()) {
    try {
      configureGoogleSignIn();
      await GoogleSignin.signOut();
    } catch (err) {
      // Best effort: the Supabase session is already gone.
      console.warn('Google sign-out failed', err);
    }
  }
  if (error) {
    throw AppError.from(error);
  }
}

// --- Validation -------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) {
    return 'Email is required.';
  }
  if (!EMAIL_RE.test(value)) {
    return 'Enter a valid email address.';
  }
  return null;
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(pw: string): string | null {
  if (!pw) {
    return 'Password is required.';
  }
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
