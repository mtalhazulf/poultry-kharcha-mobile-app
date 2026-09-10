import 'react-native-config';

declare module 'react-native-config' {
  export interface NativeConfig {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    GOOGLE_WEB_CLIENT_ID?: string;
    OAUTH_REDIRECT_URL?: string;
  }
}
