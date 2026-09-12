import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { act } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { useAuth } from '../src/context/AuthProvider';
import {
  BiometricLockProvider,
  RELOCK_AFTER_MS,
  useBiometricLock,
  type BiometricLockContextValue,
} from '../src/context/BiometricLockProvider';
import { biometricPreferenceKey, biometricServiceFor } from '../src/lib/biometrics';

jest.mock('../src/context/AuthProvider', () => ({ useAuth: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type KeychainMock = typeof import('../__mocks__/react-native-keychain');
const keychain = jest.requireMock<KeychainMock>('react-native-keychain');
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

let lock: BiometricLockContextValue | null = null;
function Probe() {
  lock = useBiometricLock();
  return null;
}

const signOut = jest.fn(async () => undefined);

function setAuth(userId: string | null, initializing = false) {
  const user = userId ? { id: userId } : null;
  mockedUseAuth.mockReturnValue({
    user,
    session: user ? { user } : null,
    initializing,
    signOut,
  } as unknown as ReturnType<typeof useAuth>);
}

function tree() {
  return (
    <BiometricLockProvider>
      <Probe />
    </BiometricLockProvider>
  );
}

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    });
  }
}

function current(): BiometricLockContextValue {
  if (!lock) {
    throw new Error('provider not rendered');
  }
  return lock;
}

async function enrollFor(userId: string) {
  await keychain.setGenericPassword(userId, 'secret', {
    service: biometricServiceFor(userId),
    storage: keychain.STORAGE_TYPE.AES_GCM,
  });
  await AsyncStorage.setItem(biometricPreferenceKey(userId), '1');
}

let renderer: ReactTestRenderer | null = null;
let appStateHandlers: Array<(state: AppStateStatus) => void> = [];
let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  keychain.__resetKeychainMock();
  jest.clearAllMocks();
  keychain.getSupportedBiometryType.mockImplementation(
    async () => keychain.BIOMETRY_TYPE.FINGERPRINT,
  );
  await AsyncStorage.clear();
  lock = null;
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'change') {
      appStateHandlers.push(handler as (state: AppStateStatus) => void);
    }
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  if (renderer) {
    const r = renderer;
    await act(async () => r.unmount());
    renderer = null;
  }
  warnSpy.mockRestore();
  jest.restoreAllMocks();
});

async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(tree());
  });
}

async function rerender() {
  await act(async () => {
    renderer?.update(tree());
  });
}

describe('BiometricLockProvider', () => {
  it('locks on cold start when a session is restored and biometrics are on', async () => {
    await enrollFor('u1');
    setAuth('u1', true);
    await mount();
    setAuth('u1', false);
    await rerender();

    await flush();
    expect(current()).toMatchObject({
      ready: true,
      available: true,
      biometryLabel: 'Fingerprint',
      enabled: true,
      locked: true,
    });

    let unlocked = false;
    await act(async () => {
      unlocked = await current().unlock();
    });
    expect(unlocked).toBe(true);
    expect(current().locked).toBe(false);
  });

  it('locks right after a password sign-in when biometrics are on', async () => {
    await enrollFor('u1');
    setAuth(null);
    await mount();
    await flush();
    setAuth('u1');
    await rerender();
    await flush();
    expect(current()).toMatchObject({ enabled: true, locked: true, ready: true });
  });

  it('stays unlocked right after a password sign-in when biometrics are off', async () => {
    setAuth(null);
    await mount();
    await flush();
    setAuth('u1');
    await rerender();
    await flush();
    expect(current()).toMatchObject({ enabled: false, locked: false, ready: true });
  });

  it('stays unlocked on cold start when biometrics are off', async () => {
    setAuth('u1', true);
    await mount();
    setAuth('u1', false);
    await rerender();
    await flush();
    expect(current()).toMatchObject({ enabled: false, locked: false, ready: true });
  });

  it('relocks after 60 s in the background, not before', async () => {
    await enrollFor('u1');
    setAuth(null);
    await mount();
    setAuth('u1');
    await rerender();
    await flush();
    expect(current().locked).toBe(true);
    await act(async () => {
      await current().unlock();
    });
    expect(current().locked).toBe(false);

    const now = jest.spyOn(Date, 'now');
    const emit = async (state: AppStateStatus) => {
      await act(async () => appStateHandlers.forEach(handler => handler(state)));
    };

    now.mockReturnValue(1_000);
    await emit('background');
    now.mockReturnValue(1_000 + RELOCK_AFTER_MS - 1);
    await emit('active');
    expect(current().locked).toBe(false);

    now.mockReturnValue(10_000);
    await emit('background');
    now.mockReturnValue(10_000 + RELOCK_AFTER_MS);
    await emit('active');
    expect(current().locked).toBe(true);
  });

  it('keeps the app locked when the prompt is cancelled', async () => {
    await enrollFor('u1');
    setAuth('u1', true);
    await mount();
    setAuth('u1', false);
    await rerender();
    await flush();

    keychain.getGenericPassword.mockRejectedValueOnce(new Error('code: 13, msg: Use password'));
    let unlocked = true;
    await act(async () => {
      unlocked = await current().unlock();
    });
    expect(unlocked).toBe(false);
    expect(current().locked).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('turns the feature off and signs out when biometrics changed', async () => {
    await enrollFor('u1');
    setAuth('u1', true);
    await mount();
    setAuth('u1', false);
    await rerender();
    await flush();

    keychain.getGenericPassword.mockRejectedValueOnce(
      new Error('Wrapped error: Key permanently invalidated'),
    );
    let unlocked = true;
    await act(async () => {
      unlocked = await current().unlock();
    });
    expect(unlocked).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(current()).toMatchObject({ enabled: false, locked: true });
    await expect(AsyncStorage.getItem(biometricPreferenceKey('u1'))).resolves.toBeNull();

    // A second unlock attempt must not open the app while the session lingers.
    await act(async () => {
      unlocked = await current().unlock();
    });
    expect(unlocked).toBe(false);
    expect(current().locked).toBe(true);

    setAuth(null);
    await rerender();
    await flush();
    expect(current().locked).toBe(false);
  });

  it('keeps the secret and preference across a sign-out', async () => {
    await enrollFor('u1');
    setAuth(null);
    await mount();
    setAuth('u1');
    await rerender();
    await flush();

    setAuth(null);
    await rerender();
    await flush();
    await expect(AsyncStorage.getItem(biometricPreferenceKey('u1'))).resolves.toBe('1');
    await expect(keychain.hasGenericPassword({ service: biometricServiceFor('u1') })).resolves.toBe(
      true,
    );
  });

  it('clears the previous account\'s secret when a different account signs in', async () => {
    await enrollFor('u1');
    setAuth(null);
    await mount();
    setAuth('u1');
    await rerender();
    await flush();

    setAuth('u2');
    await rerender();
    await flush();
    await expect(AsyncStorage.getItem(biometricPreferenceKey('u1'))).resolves.toBeNull();
    await expect(keychain.hasGenericPassword({ service: biometricServiceFor('u1') })).resolves.toBe(
      false,
    );
  });

  it('enables and disables for the signed-in user', async () => {
    setAuth(null);
    await mount();
    setAuth('u1');
    await rerender();
    await flush();
    expect(current().enabled).toBe(false);

    await act(async () => {
      await current().enable();
    });
    expect(current().enabled).toBe(true);
    await expect(AsyncStorage.getItem(biometricPreferenceKey('u1'))).resolves.toBe('1');

    await act(async () => {
      await current().disable();
    });
    expect(current().enabled).toBe(false);
    await expect(keychain.hasGenericPassword({ service: biometricServiceFor('u1') })).resolves.toBe(
      false,
    );
  });

  it('resolves quietly when enabling is cancelled, and throws when unavailable', async () => {
    setAuth(null);
    await mount();
    setAuth('u1');
    await rerender();
    await flush();

    keychain.setGenericPassword.mockRejectedValueOnce(new Error('code: 13, msg: Cancel'));
    await act(async () => {
      await current().enable();
    });
    expect(current().enabled).toBe(false);

    keychain.getSupportedBiometryType.mockResolvedValue(null);
    await act(async () => {
      await expect(current().enable()).rejects.toMatchObject({ kind: 'validation' });
    });
    expect(current().enabled).toBe(false);
  });
});
