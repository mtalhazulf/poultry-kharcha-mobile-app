import Config from 'react-native-config';

function required(name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  const value = Config[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in, then rebuild the app ` +
        '(react-native-config bakes values in at build time).',
    );
  }
  return value;
}

export const env = {
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY'),
  /** Web client ID from Google Cloud — required for Google Sign-In on Android. */
  GOOGLE_WEB_CLIENT_ID: Config.GOOGLE_WEB_CLIENT_ID ?? '',
  /** Must match the intent-filter in AndroidManifest.xml and the Supabase redirect allow-list. */
  OAUTH_REDIRECT_URL: Config.OAUTH_REDIRECT_URL ?? 'kharcha://auth/callback',
} as const;
