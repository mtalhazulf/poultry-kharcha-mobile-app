import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSecureStorage, keychainServiceFor } from '../src/lib/secureStorage';

type KeychainMock = typeof import('../__mocks__/react-native-keychain');
const keychain = jest.requireMock<KeychainMock>('react-native-keychain');

const KEY = 'sb-example-auth-token';
const SESSION = JSON.stringify({ access_token: 'a', refresh_token: 'r' });

let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  keychain.__resetKeychainMock();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => warnSpy.mockRestore());

describe('secureStorage', () => {
  it('stores each key in its own keychain service without user authentication', async () => {
    const storage = createSecureStorage();
    await storage.setItem(KEY, SESSION);

    expect(keychain.setGenericPassword).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        service: keychainServiceFor(KEY),
        storage: keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      }),
    );
    const call = keychain.setGenericPassword.mock.calls[0];
    expect(call?.[2]).not.toHaveProperty('accessControl');
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();

    // A fresh adapter (cold start) reads it back from the keychain.
    await expect(createSecureStorage().getItem(KEY)).resolves.toBe(SESSION);
  });

  it('round-trips empty strings', async () => {
    const storage = createSecureStorage();
    await storage.setItem(KEY, '');
    await expect(createSecureStorage().getItem(KEY)).resolves.toBe('');
  });

  it('returns null for unknown keys', async () => {
    await expect(createSecureStorage().getItem('missing')).resolves.toBeNull();
  });

  it('migrates a legacy AsyncStorage session on first read', async () => {
    await AsyncStorage.setItem(KEY, SESSION);
    const storage = createSecureStorage();

    await expect(storage.getItem(KEY)).resolves.toBe(SESSION);
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
    await expect(keychain.hasGenericPassword({ service: keychainServiceFor(KEY) })).resolves.toBe(
      true,
    );
    await expect(createSecureStorage().getItem(KEY)).resolves.toBe(SESSION);
  });

  it('keeps the legacy copy when the migration write fails', async () => {
    await AsyncStorage.setItem(KEY, SESSION);
    keychain.setGenericPassword.mockRejectedValueOnce(new Error('E_CRYPTO_FAILED'));

    await expect(createSecureStorage().getItem(KEY)).resolves.toBe(SESSION);
    await expect(AsyncStorage.getItem(KEY)).resolves.toBe(SESSION);
  });

  it('falls back to AsyncStorage when the keychain cannot be read', async () => {
    await AsyncStorage.setItem(KEY, SESSION);
    keychain.getGenericPassword.mockRejectedValueOnce(new Error('E_KEYSTORE_ACCESS_ERROR'));
    const storage = createSecureStorage();

    await expect(storage.getItem(KEY)).resolves.toBe(SESSION);
    // Not cached: the next read retries the keychain (and migrates).
    await expect(storage.getItem(KEY)).resolves.toBe(SESSION);
    expect(keychain.getGenericPassword).toHaveBeenCalledTimes(2);
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
  });

  it('falls back to AsyncStorage when the keychain cannot be written', async () => {
    keychain.setGenericPassword.mockRejectedValueOnce(new Error('E_CRYPTO_FAILED'));
    await createSecureStorage().setItem(KEY, SESSION);
    await expect(AsyncStorage.getItem(KEY)).resolves.toBe(SESSION);
  });

  it('removes the value from both stores', async () => {
    await AsyncStorage.setItem(KEY, 'stale');
    const storage = createSecureStorage();
    await storage.setItem(KEY, SESSION);
    await storage.removeItem(KEY);

    await expect(storage.getItem(KEY)).resolves.toBeNull();
    await expect(createSecureStorage().getItem(KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
  });

  it('serves repeated reads from memory', async () => {
    const storage = createSecureStorage();
    await storage.setItem(KEY, SESSION);
    await storage.getItem(KEY);
    await storage.getItem(KEY);
    expect(keychain.getGenericPassword).not.toHaveBeenCalled();
  });

  it('never lets a slow first read overwrite a newer write', async () => {
    await keychain.setGenericPassword('mps', 'v1:old', { service: keychainServiceFor(KEY) });
    let release: () => void = () => undefined;
    keychain.getGenericPassword.mockImplementationOnce(
      options =>
        new Promise<Awaited<ReturnType<typeof keychain.getGenericPassword>>>(resolve => {
          release = () =>
            resolve({
              username: 'mps',
              password: 'v1:old',
              service: options?.service ?? '',
              storage: keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
            });
        }),
    );
    const storage = createSecureStorage();
    const firstRead = storage.getItem(KEY);
    await storage.setItem(KEY, 'new');
    release();

    await expect(firstRead).resolves.toBe('new');
    await expect(storage.getItem(KEY)).resolves.toBe('new');
  });
});
