import { colors, type ColorToken } from '../theme';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface TonePalette {
  /** Subtle background. */
  bg: string;
  /** Text on `bg`, at least 4.5:1. */
  fg: string;
  fgToken: ColorToken;
  /** Icon / dot color (non-text, 3:1 is enough). */
  icon: string;
}

export const TONES: Readonly<Record<Tone, TonePalette>> = {
  neutral: {
    bg: colors.surfaceMuted,
    fg: colors.textSecondary,
    fgToken: 'textSecondary',
    icon: colors.textSecondary,
  },
  primary: {
    bg: colors.primarySubtle,
    fg: colors.primaryText,
    fgToken: 'primaryText',
    icon: colors.primary,
  },
  success: { bg: colors.successSubtle, fg: colors.success, fgToken: 'success', icon: colors.success },
  warning: { bg: colors.warningSubtle, fg: colors.warning, fgToken: 'warning', icon: colors.warning },
  danger: { bg: colors.dangerSubtle, fg: colors.dangerText, fgToken: 'dangerText', icon: colors.danger },
  info: { bg: colors.infoSubtle, fg: colors.info, fgToken: 'info', icon: colors.info },
};
