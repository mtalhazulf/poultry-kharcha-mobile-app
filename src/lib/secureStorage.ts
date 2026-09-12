/**
 * Supabase auth storage adapter backed by the Android Keystore / iOS Keychain
 * (react-native-keychain).
 *
 * - One keychain service per storage key, encrypted with a key that needs no
 *   user authentication (the session must refresh in the background; the
 *   biometric gate lives in lib/biometrics).
 * - A session persisted by an older build in AsyncStorage is moved into the
 *   keychain on first read and then deleted from AsyncStorage.
 * - If the keychain is unusable the adapter degrades to AsyncStorage rather
 *   than signing the user out.
 * - Values are cached in memory: Supabase reads the session on every
 *   `getSession()`, and it already lives in JS memory anyway.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const SERVICE_PREFIX = 'mps.secure.v1:';
const USERNAME = 'mps';
/** Keychain rejects empty passwords; the prefix lets "" round-trip. */
const VALUE_PREFIX = 'v1:';

export interface AuthStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function keychainServiceFor(key: string): string {
  return `${SERVICE_PREFIX}${key}`;
}

function encodeValue(value: string): string {
  return `${VALUE_PREFIX}${value}`;
}

function decodeValue(stored: string): string {
  return stored.startsWith(VALUE_PREFIX) ? stored.slice(VALUE_PREFIX.length) : stored;
}

function warn(message: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.warn(`[secureStorage] ${message}: ${detail}`);
}

async function readKeychain(key: string): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: keychainServiceFor(key) });
  return credentials ? decodeValue(credentials.password) : null;
}

async function writeKeychain(key: string, value: string): Promise<void> {
  const result = await Keychain.setGenericPassword(USERNAME, encodeValue(value), {
    service: keychainServiceFor(key),
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (!result) {
    throw new Error('Keychain refused the value');
  }
}

/** Builds an adapter with its own cache (tests create fresh ones). */
export function createSecureStorage(): AuthStorageAdapter {
  const cache = new Map<string, string | null>();
  const pendingReads = new Map<string, Promise<string | null>>();
  // Bumped by every write so a slow first read never overwrites newer data.
  const generations = new Map<string, number>();

  const generationOf = (key: string) => generations.get(key) ?? 0;
  const bump = (key: string) => generations.set(key, generationOf(key) + 1);

  async function load(key: string): Promise<string | null> {
    const generation = generationOf(key);
    let value: string | null = null;
    let keychainOk = true;
    try {
      value = await readKeychain(key);
    } catch (err) {
      keychainOk = false;
      warn('keychain read failed', err);
    }

    if (value === null) {
      let legacy: string | null = null;
      try {
        legacy = await AsyncStorage.getItem(key);
      } catch (err) {
        warn('AsyncStorage read failed', err);
      }
      if (legacy !== null) {
        value = legacy;
        if (keychainOk) {
          try {
            await writeKeychain(key, legacy);
            await AsyncStorage.removeItem(key);
          } catch (err) {
            // Keep the AsyncStorage copy; we will try again next launch.
            keychainOk = false;
            warn('migration to keychain failed', err);
          }
        }
      }
    }

    if (generationOf(key) !== generation) {
      return cache.get(key) ?? null;
    }
    if (keychainOk) {
      cache.set(key, value);
    }
    return value;
  }

  return {
    getItem(key) {
      if (cache.has(key)) {
        return Promise.resolve(cache.get(key) ?? null);
      }
      let pending = pendingReads.get(key);
      if (!pending) {
        pending = load(key).finally(() => pendingReads.delete(key));
        pendingReads.set(key, pending);
      }
      return pending;
    },

    async setItem(key, value) {
      bump(key);
      cache.set(key, value);
      try {
        await writeKeychain(key, value);
      } catch (err) {
        warn('keychain write failed, falling back to AsyncStorage', err);
        await AsyncStorage.setItem(key, value);
        return;
      }
      try {
        // A legacy plaintext copy must not outlive the keychain one.
        await AsyncStorage.removeItem(key);
      } catch (err) {
        warn('could not remove legacy AsyncStorage copy', err);
      }
    },

    async removeItem(key) {
      bump(key);
      cache.set(key, null);
      const results = await Promise.allSettled([
        Keychain.resetGenericPassword({ service: keychainServiceFor(key) }),
        AsyncStorage.removeItem(key),
      ]);
      for (const result of results) {
        if (result.status === 'rejected') {
          warn('remove failed', result.reason);
        }
      }
    },
  };
}

/** The adapter passed to `createClient({ auth: { storage } })`. */
export const secureStorage: AuthStorageAdapter = createSecureStorage();
