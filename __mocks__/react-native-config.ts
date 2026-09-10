/**
 * Jest stand-in for react-native-config (a native module that cannot load
 * under Node). Wired up via moduleNameMapper in jest.config.js.
 */
const Config = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
  GOOGLE_WEB_CLIENT_ID: '',
  OAUTH_REDIRECT_URL: 'kharcha://auth/callback',
};

export { Config };
export default Config;
