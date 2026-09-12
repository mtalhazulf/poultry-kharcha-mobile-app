import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  biometricPreferenceKey,
  biometricServiceFor,
  biometryLabelFor,
  classifyKeychainError,
  clearBiometricSecret,
  enrollBiometricSecret,
  getBiometricCapability,
  isBiometricEnabled,
  setBiometricEnabled,
  shouldRelock,
  UNLOCK_PROMPT,
  verifyBiometric,
} from '../src/lib/biometrics';

type KeychainMock = typeof import('../__mocks__/react-native-keychain');
const keychain = jest.requireMock<KeychainMock>('react-native-keychain');

beforeEach(async () => {
  keychain.__resetKeychainMock();
  jest.clearAllMocks();
  keychain.getSupportedBiometryType.mockImplementation(
    async () => keychain.BIOMETRY_TYPE.FINGERPRINT,
  );
  await AsyncStorage.clear();
});

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => warnSpy.mockRestore());

describe('biometryLabelFor', () => {
  it('maps keychain types to user-facing labels', () => {
    expect(biometryLabelFor('Fingerprint')).toBe('Fingerprint');
    expect(biometryLabelFor('TouchID')).toBe('Fingerprint');
    expect(biometryLabelFor('Face')).toBe('Face unlock');
    expect(biometryLabelFor('FaceID')).toBe('Face unlock');
    expect(biometryLabelFor('Iris')).toBe('Biometrics');
    expect(biometryLabelFor(null)).toBe('Biometrics');
  });
});

describe('classifyKeychainError', () => {
  it('treats the negative button and user cancels as cancelled', () => {
    expect(classifyKeychainError(new Error('code: 13, msg: Use password'))).toBe('cancelled');
    expect(classifyKeychainError(new Error('code: 10, msg: Fingerprint operation canceled by user'))).toBe(
      'cancelled',
    );
    expect(classifyKeychainError(new Error('code: 5, msg: Canceled'))).toBe('cancelled');
    expect(classifyKeychainError(new Error('User canceled the operation.'))).toBe('cancelled');
  });

  it('detects invalidated keys and removed enrollments', () => {
    expect(classifyKeychainError(new Error('Wrapped error: Key permanently invalidated'))).toBe(
      'invalidated',
    );
    expect(
      classifyKeychainError(new Error('Could not start biometric Authentication. No permissions granted.')),
    ).toBe('invalidated');
    expect(classifyKeychainError(new Error('code: 11, msg: No fingerprints enrolled.'))).toBe(
      'invalidated',
    );
  });

  it('maps missing hardware to unavailable and everything else to error', () => {
    expect(classifyKeychainError(new Error('code: 12, msg: No hardware'))).toBe('unavailable');
    expect(classifyKeychainError(new Error('code: 7, msg: Too many attempts'))).toBe('error');
    expect(classifyKeychainError(new Error('boom'))).toBe('error');
    expect(classifyKeychainError('weird')).toBe('error');
    expect(classifyKeychainError(undefined)).toBe('error');
  });
});

describe('getBiometricCapability', () => {
  it('reports the enrolled biometry', async () => {
    await expect(getBiometricCapability()).resolves.toEqual({
      available: true,
      type: 'Fingerprint',
      label: 'Fingerprint',
    });
  });

  it('is unavailable when nothing is enrolled or the check fails', async () => {
    keychain.getSupportedBiometryType.mockResolvedValueOnce(null);
    await expect(getBiometricCapability()).resolves.toMatchObject({ available: false });
    keychain.getSupportedBiometryType.mockRejectedValueOnce(new Error('E_SUPPORTED_BIOMETRY_ERROR'));
    await expect(getBiometricCapability()).resolves.toMatchObject({
      available: false,
      label: 'Biometrics',
    });
  });
});

describe('enrollBiometricSecret', () => {
  it('stores a biometric-protected secret and reads it back', async () => {
    await expect(enrollBiometricSecret('u1')).resolves.toBe('success');
    expect(keychain.setGenericPassword).toHaveBeenCalledWith(
      'u1',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.objectContaining({
        service: biometricServiceFor('u1'),
        accessControl: keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
        storage: keychain.STORAGE_TYPE.AES_GCM,
        authenticationPrompt: expect.objectContaining({ cancel: expect.any(String) }),
      }),
    );
    expect(keychain.getGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({ service: biometricServiceFor('u1') }),
    );
    await expect(keychain.hasGenericPassword({ service: biometricServiceFor('u1') })).resolves.toBe(
      true,
    );
  });

  it('is unavailable without enrolled biometrics and stores nothing', async () => {
    keychain.getSupportedBiometryType.mockResolvedValueOnce(null);
    await expect(enrollBiometricSecret('u1')).resolves.toBe('unavailable');
    expect(keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  it('cleans up when the prompt is cancelled', async () => {
    keychain.setGenericPassword.mockRejectedValueOnce(new Error('code: 13, msg: Cancel'));
    await expect(enrollBiometricSecret('u1')).resolves.toBe('cancelled');
    await expect(keychain.hasGenericPassword({ service: biometricServiceFor('u1') })).resolves.toBe(
      false,
    );
  });

  it('fails when the secret does not read back', async () => {
    keychain.getGenericPassword.mockResolvedValueOnce({
      username: 'u1',
      password: 'something-else',
      service: biometricServiceFor('u1'),
      storage: keychain.STORAGE_TYPE.AES_GCM,
    });
    await expect(enrollBiometricSecret('u1')).resolves.toBe('error');
    await expect(keychain.hasGenericPassword({ service: biometricServiceFor('u1') })).resolves.toBe(
      false,
    );
  });
});

describe('verifyBiometric', () => {
  it('succeeds after enrollment and passes the unlock prompt', async () => {
    await enrollBiometricSecret('u1');
    keychain.getGenericPassword.mockClear();
    await expect(verifyBiometric('u1', UNLOCK_PROMPT)).resolves.toBe('success');
    expect(keychain.getGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationPrompt: { title: 'Unlock MPS Expense Tracker', cancel: 'Use password' },
      }),
    );
  });

  it('is unavailable when no secret was stored', async () => {
    await expect(verifyBiometric('u1')).resolves.toBe('unavailable');
  });

  it('is invalidated when biometrics were removed after enrollment', async () => {
    await enrollBiometricSecret('u1');
    keychain.getSupportedBiometryType.mockResolvedValue(null);
    await expect(verifyBiometric('u1')).resolves.toBe('invalidated');
  });

  it('classifies prompt failures', async () => {
    await enrollBiometricSecret('u1');
    keychain.getGenericPassword.mockRejectedValueOnce(new Error('code: 13, msg: Use password'));
    await expect(verifyBiometric('u1')).resolves.toBe('cancelled');
    keychain.getGenericPassword.mockRejectedValueOnce(
      new Error('Wrapped error: Key permanently invalidated'),
    );
    await expect(verifyBiometric('u1')).resolves.toBe('invalidated');
  });

  it('rejects a secret stored for another user', async () => {
    await keychain.setGenericPassword('someone-else', 'secret', {
      service: biometricServiceFor('u1'),
    });
    await expect(verifyBiometric('u1')).resolves.toBe('invalidated');
  });
});

describe('clearBiometricSecret', () => {
  it('removes the secret and never throws', async () => {
    await enrollBiometricSecret('u1');
    await clearBiometricSecret('u1');
    await expect(keychain.hasGenericPassword({ service: biometricServiceFor('u1') })).resolves.toBe(
      false,
    );
    keychain.resetGenericPassword.mockRejectedValueOnce(new Error('E_KEYSTORE_ACCESS_ERROR'));
    await expect(clearBiometricSecret('u1')).resolves.toBeUndefined();
  });
});

describe('preference flag', () => {
  it('is stored per user under mps:biometric:v1:<userId>', async () => {
    expect(biometricPreferenceKey('u1')).toBe('mps:biometric:v1:u1');
    await expect(isBiometricEnabled('u1')).resolves.toBe(false);
    await setBiometricEnabled('u1', true);
    await expect(AsyncStorage.getItem('mps:biometric:v1:u1')).resolves.toBe('1');
    await expect(isBiometricEnabled('u1')).resolves.toBe(true);
    await expect(isBiometricEnabled('u2')).resolves.toBe(false);
    await setBiometricEnabled('u1', false);
    await expect(AsyncStorage.getItem('mps:biometric:v1:u1')).resolves.toBeNull();
  });
});

describe('shouldRelock', () => {
  it('relocks only after the full interval in the background', () => {
    expect(shouldRelock(null, 100_000, 60_000)).toBe(false);
    expect(shouldRelock(0, 59_999, 60_000)).toBe(false);
    expect(shouldRelock(0, 60_000, 60_000)).toBe(true);
  });
});
