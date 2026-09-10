/**
 * Global Jest setup (jest.config.js -> setupFiles). Runs before each test
 * file, after the React Native preset's own setup.
 *
 * Native-backed libraries that have no JS fallback are replaced with light
 * stubs so importing src/lib/* in a unit test does not crash on a missing
 * TurboModule. Tests that need specific behaviour can `jest.mock` again.
 */

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
    signOut: jest.fn(async () => null),
    revokeAccess: jest.fn(async () => null),
    getTokens: jest.fn(async () => ({ idToken: '', accessToken: '' })),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
  isErrorWithCode: (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error,
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ didCancel: true })),
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}));

// The polyfill is a side-effect import in index.js; it is harmless under
// Node but noisy, and Node's URL is already spec-compliant.
jest.mock('react-native-url-polyfill/auto', () => ({}));
