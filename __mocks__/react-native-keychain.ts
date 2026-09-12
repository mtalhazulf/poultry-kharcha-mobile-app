/**
 * In-memory stand-in for react-native-keychain (Android Keystore / iOS
 * Keychain are native-only). Jest picks this file up automatically for the
 * node module because __mocks__ sits next to node_modules; jest.setup.ts also
 * calls jest.mock('react-native-keychain') to make that explicit.
 *
 * Tests can script failures with `mockRejectedValueOnce` on any function and
 * wipe state with `__resetKeychainMock()`.
 */

export enum ACCESSIBLE {
  WHEN_UNLOCKED = 'AccessibleWhenUnlocked',
  AFTER_FIRST_UNLOCK = 'AccessibleAfterFirstUnlock',
  ALWAYS = 'AccessibleAlways',
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'AccessibleWhenPasscodeSetThisDeviceOnly',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'AccessibleWhenUnlockedThisDeviceOnly',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AccessibleAfterFirstUnlockThisDeviceOnly',
}

export enum ACCESS_CONTROL {
  USER_PRESENCE = 'UserPresence',
  BIOMETRY_ANY = 'BiometryAny',
  BIOMETRY_CURRENT_SET = 'BiometryCurrentSet',
  DEVICE_PASSCODE = 'DevicePasscode',
  APPLICATION_PASSWORD = 'ApplicationPassword',
  BIOMETRY_ANY_OR_DEVICE_PASSCODE = 'BiometryAnyOrDevicePasscode',
  BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE = 'BiometryCurrentSetOrDevicePasscode',
}

export enum AUTHENTICATION_TYPE {
  DEVICE_PASSCODE_OR_BIOMETRICS = 'AuthenticationWithBiometricsDevicePasscode',
  BIOMETRICS = 'AuthenticationWithBiometrics',
}

export enum SECURITY_LEVEL {
  SECURE_SOFTWARE = 'SECURE_SOFTWARE',
  SECURE_HARDWARE = 'SECURE_HARDWARE',
  ANY = 'ANY',
}

export enum BIOMETRY_TYPE {
  TOUCH_ID = 'TouchID',
  FACE_ID = 'FaceID',
  OPTIC_ID = 'OpticID',
  FINGERPRINT = 'Fingerprint',
  FACE = 'Face',
  IRIS = 'Iris',
}

export enum STORAGE_TYPE {
  AES_CBC = 'KeystoreAESCBC',
  AES_GCM_NO_AUTH = 'KeystoreAESGCM_NoAuth',
  AES_GCM = 'KeystoreAESGCM',
  RSA = 'KeystoreRSAECB',
}

interface Options {
  service?: string;
  server?: string;
  storage?: string;
}

interface Entry {
  username: string;
  password: string;
  storage: string;
}

const DEFAULT_SERVICE = 'com.mps.expensetracker';
const entries = new Map<string, Entry>();

const serviceOf = (options?: Options) => options?.service ?? options?.server ?? DEFAULT_SERVICE;

export const setGenericPassword = jest.fn(
  async (username: string, password: string, options?: Options) => {
    if (!username || !password) {
      throw new Error('E_EMPTY_PARAMETERS');
    }
    const storage = options?.storage ?? STORAGE_TYPE.AES_GCM_NO_AUTH;
    entries.set(serviceOf(options), { username, password, storage });
    return { service: serviceOf(options), storage };
  },
);

export const getGenericPassword = jest.fn(async (options?: Options) => {
  const entry = entries.get(serviceOf(options));
  return entry ? { ...entry, service: serviceOf(options) } : false;
});

export const hasGenericPassword = jest.fn(async (options?: Options) =>
  entries.has(serviceOf(options)),
);

export const resetGenericPassword = jest.fn(async (options?: Options) => {
  entries.delete(serviceOf(options));
  return true;
});

export const getAllGenericPasswordServices = jest.fn(async () => [...entries.keys()]);

export const setInternetCredentials = jest.fn(
  async (server: string, username: string, password: string, options?: Options) =>
    setGenericPassword(username, password, { ...options, service: server }),
);
export const getInternetCredentials = jest.fn(async (server: string) =>
  getGenericPassword({ service: server }),
);
export const hasInternetCredentials = jest.fn(async (options: Options) =>
  hasGenericPassword(options),
);
export const resetInternetCredentials = jest.fn(async (options: Options) => {
  entries.delete(serviceOf(options));
});

export const getSupportedBiometryType = jest.fn(
  async (): Promise<BIOMETRY_TYPE | null> => BIOMETRY_TYPE.FINGERPRINT,
);
export const canImplyAuthentication = jest.fn(async () => true);
export const getSecurityLevel = jest.fn(async () => SECURITY_LEVEL.SECURE_HARDWARE);
export const isPasscodeAuthAvailable = jest.fn(async () => true);
export const requestSharedWebCredentials = jest.fn(async () => false);
export const setSharedWebCredentials = jest.fn(async () => undefined);

/** Test helper: empties the fake keychain. */
export function __resetKeychainMock(): void {
  entries.clear();
}

export default {
  ACCESSIBLE,
  ACCESS_CONTROL,
  AUTHENTICATION_TYPE,
  SECURITY_LEVEL,
  BIOMETRY_TYPE,
  STORAGE_TYPE,
  setGenericPassword,
  getGenericPassword,
  hasGenericPassword,
  resetGenericPassword,
  getAllGenericPasswordServices,
  setInternetCredentials,
  getInternetCredentials,
  hasInternetCredentials,
  resetInternetCredentials,
  getSupportedBiometryType,
  canImplyAuthentication,
  getSecurityLevel,
  isPasscodeAuthAvailable,
  requestSharedWebCredentials,
  setSharedWebCredentials,
};
