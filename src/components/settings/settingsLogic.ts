/**
 * Pure copy helpers for Settings and the expense type editor.
 */
import type { BiometryLabel } from '../../lib/biometrics';

export interface BiometricRowCopy {
  title: string;
  subtitle: string;
}

/**
 * "Fingerprint sign-in" / "Unlock the app with fingerprint instead of your
 * password". The generic label reads "Biometric sign-in".
 *
 * `enabled` is the stored preference. Removing every enrolled fingerprint
 * leaves the two out of step (the preference says on, the phone says
 * unavailable), and telling that person to "set up" biometrics next to a
 * switch that reads on explains nothing — say what actually happened instead.
 */
export function biometricRowCopy(
  label: BiometryLabel,
  available: boolean,
  enabled = false,
): BiometricRowCopy {
  const generic = label === 'Biometrics';
  let subtitle: string;
  if (available) {
    subtitle = `Unlock the app with ${
      generic ? 'biometrics' : label.toLowerCase()
    } instead of your password`;
  } else if (enabled) {
    subtitle = 'Biometrics changed on this phone. Turn this off, or set them up again.';
  } else {
    subtitle = 'Set up fingerprint or face unlock on this phone first';
  }
  return {
    title: generic ? 'Biometric sign-in' : `${label} sign-in`,
    subtitle,
  };
}

/** Icon key -> spoken name: "hard-hat" -> "Hard hat". */
export function iconChoiceLabel(key: string): string {
  const words = key.split('-').filter(Boolean).join(' ');
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : key;
}
