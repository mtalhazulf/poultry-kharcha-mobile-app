/**
 * Biometric sign-in on top of react-native-keychain.
 *
 * Enabling stores a random secret under a per-user keychain service with
 * BIOMETRY access control and the AES-GCM storage whose Keystore key requires
 * user authentication, then reads it back through the system prompt. Unlocking
 * is "can we decrypt that secret again": the OS decides, we never compare
 * fingerprints. The on/off preference lives in AsyncStorage
 * (`mps:biometric:v1:<userId>`) so we know whether to lock without prompting.
 *
 * Android notes (react-native-keychain v10, AES_GCM storage):
 * - The Keystore key is authentication-bound (strong biometric or device
 *   credential, 5 s validity). Removing the screen lock permanently
 *   invalidates it; we surface that as `invalidated`.
 * - Removing every enrolled biometric makes `getSupportedBiometryType()`
 *   return null; with a secret still stored that is also `invalidated`.
 * - BiometricPrompt errors arrive as "code: N, msg: ..." messages.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

export type BiometricResult = 'success' | 'cancelled' | 'invalidated' | 'unavailable' | 'error';

export type BiometryLabel = 'Fingerprint' | 'Face unlock' | 'Biometrics';

export interface BiometricCapability {
  available: boolean;
  /** Raw keychain value ("Fingerprint", "Face", "FaceID", ...) or null. */
  type: string | null;
  label: BiometryLabel;
}

export interface BiometricPromptText {
  title: string;
  subtitle?: string;
  description?: string;
  /** Negative button. Required on Android when the prompt is biometric-only. */
  cancel: string;
}

export const UNLOCK_PROMPT: BiometricPromptText = {
  title: 'Unlock MPS Expense Tracker',
  cancel: 'Use password',
};

export const ENROLL_PROMPT: BiometricPromptText = {
  title: 'Turn on biometric sign-in',
  subtitle: 'Confirm it is you',
  cancel: 'Cancel',
};

const PREF_PREFIX = 'mps:biometric:v1:';
const SERVICE_PREFIX = 'mps.biometric.v1:';

export function biometricPreferenceKey(userId: string): string {
  return `${PREF_PREFIX}${userId}`;
}

export function biometricServiceFor(userId: string): string {
  return `${SERVICE_PREFIX}${userId}`;
}

/** Keychain biometry type -> label shown in Settings and on the Lock screen. */
export function biometryLabelFor(type: string | null | undefined): BiometryLabel {
  switch (type) {
    case 'Fingerprint':
    case 'TouchID':
      return 'Fingerprint';
    case 'Face':
    case 'FaceID':
      return 'Face unlock';
    default:
      return 'Biometrics';
  }
}

/** BiometricPrompt error codes (androidx.biometric.BiometricPrompt.ERROR_*). */
const PROMPT_CANCELLED = new Set([5, 10, 13]); // CANCELED, USER_CANCELED, NEGATIVE_BUTTON
const PROMPT_NOT_ENROLLED = new Set([11, 14]); // NO_BIOMETRICS, NO_DEVICE_CREDENTIAL
const PROMPT_NO_HARDWARE = 12; // HW_NOT_PRESENT

const INVALIDATED_PATTERN =
  /permanently invalidated|KeyPermanentlyInvalidated|No permissions granted|Authentication tag verification failed|AEADBadTag/i;

/** Maps a rejected keychain call to a result. Pure; exported for tests. */
export function classifyKeychainError(err: unknown): Exclude<BiometricResult, 'success'> {
  const raw =
    typeof err === 'object' && err !== null && 'message' in err
      ? (err as { message?: unknown }).message
      : err;
  const message = typeof raw === 'string' ? raw : String(raw ?? '');

  if (INVALIDATED_PATTERN.test(message)) {
    return 'invalidated';
  }
  const code = /code:\s*(-?\d+)/i.exec(message)?.[1];
  if (code !== undefined) {
    const n = Number(code);
    if (PROMPT_CANCELLED.has(n)) {
      return 'cancelled';
    }
    if (PROMPT_NOT_ENROLLED.has(n)) {
      return 'invalidated';
    }
    if (n === PROMPT_NO_HARDWARE) {
      return 'unavailable';
    }
    // Lockout (7, 9), timeout (3), hardware busy (1), ...: try again later.
    return 'error';
  }
  if (/cancel/i.test(message)) {
    return 'cancelled';
  }
  return 'error';
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const type = await Keychain.getSupportedBiometryType();
    return { available: type != null, type: type ?? null, label: biometryLabelFor(type) };
  } catch (err) {
    console.warn('[biometrics] capability check failed', err);
    return { available: false, type: null, label: 'Biometrics' };
  }
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  const cryptoApi = (
    globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }
  ).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    // The secret only proves a successful decrypt; the Keystore key protects it.
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function resetQuietly(service: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service });
  } catch (err) {
    console.warn('[biometrics] could not clear secret', err);
  }
}

/**
 * Stores a biometric-protected secret for the user and reads it back through
 * the system prompt. Resolves 'success' only when the round trip worked.
 */
export async function enrollBiometricSecret(
  userId: string,
  prompt: BiometricPromptText = ENROLL_PROMPT,
): Promise<BiometricResult> {
  const capability = await getBiometricCapability();
  if (!capability.available) {
    return 'unavailable';
  }
  const service = biometricServiceFor(userId);
  const secret = randomSecret();
  // Always start from a fresh Keystore key; an old one may be invalidated.
  await resetQuietly(service);
  try {
    const stored = await Keychain.setGenericPassword(userId, secret, {
      service,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      storage: Keychain.STORAGE_TYPE.AES_GCM,
      accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      authenticationPrompt: prompt,
    });
    if (!stored) {
      await resetQuietly(service);
      return 'error';
    }
    const readBack = await Keychain.getGenericPassword({
      service,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: prompt,
    });
    if (!readBack || readBack.password !== secret) {
      await resetQuietly(service);
      return 'error';
    }
    return 'success';
  } catch (err) {
    await resetQuietly(service);
    return classifyKeychainError(err);
  }
}

/** Prompts for biometrics by decrypting the user's secret. */
export async function verifyBiometric(
  userId: string,
  prompt: BiometricPromptText = UNLOCK_PROMPT,
): Promise<BiometricResult> {
  const service = biometricServiceFor(userId);
  let hasSecret = false;
  try {
    hasSecret = await Keychain.hasGenericPassword({ service });
  } catch (err) {
    return classifyKeychainError(err);
  }
  if (!hasSecret) {
    return 'unavailable';
  }
  const capability = await getBiometricCapability();
  if (!capability.available) {
    // A secret exists but no biometric is enrolled any more.
    return 'invalidated';
  }
  try {
    const credentials = await Keychain.getGenericPassword({
      service,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: prompt,
    });
    if (!credentials) {
      return 'unavailable';
    }
    return credentials.username === userId && credentials.password.length > 0
      ? 'success'
      : 'invalidated';
  } catch (err) {
    return classifyKeychainError(err);
  }
}

export async function clearBiometricSecret(userId: string): Promise<void> {
  await resetQuietly(biometricServiceFor(userId));
}

export async function isBiometricEnabled(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(biometricPreferenceKey(userId))) === '1';
  } catch (err) {
    console.warn('[biometrics] could not read preference', err);
    return false;
  }
}

export async function setBiometricEnabled(userId: string, enabled: boolean): Promise<void> {
  const key = biometricPreferenceKey(userId);
  try {
    if (enabled) {
      await AsyncStorage.setItem(key, '1');
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[biometrics] could not save preference', err);
    if (enabled) {
      throw err;
    }
  }
}

/** True when the app was in the background long enough to lock again. */
export function shouldRelock(backgroundAt: number | null, now: number, afterMs: number): boolean {
  return backgroundAt !== null && now - backgroundAt >= afterMs;
}
