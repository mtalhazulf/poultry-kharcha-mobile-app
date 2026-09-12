/**
 * Design tokens for the enterprise "clean light" look (docs/ARCHITECTURE.md §6).
 * White surfaces on light gray, one green accent, hairline borders, compact
 * rows. Every screen and primitive reads from here — no ad-hoc hex values.
 */
import { StyleSheet, type TextStyle } from 'react-native';

// --- Color ------------------------------------------------------------------

export const colors = {
  /** App background behind cards and lists. */
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  /** Inputs at rest, pressed rows, segmented track, skeletons. */
  surfaceMuted: '#F2F4F7',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',

  text: '#101828',
  textSecondary: '#475467',
  textTertiary: '#98A2B3',
  /** Text and icons on a filled primary/danger surface. */
  textInverse: '#FFFFFF',

  primary: '#1B7F5A',
  primaryPressed: '#15664A',
  primarySubtle: '#E7F4EE',
  /** Brand-colored text on white or primarySubtle (AA contrast). */
  primaryText: '#136246',

  danger: '#D92D20',
  dangerPressed: '#B42318',
  dangerSubtle: '#FEF3F2',
  /** Danger-colored small text on dangerSubtle (AA contrast). */
  dangerText: '#B42318',
  warning: '#B54708',
  warningSubtle: '#FFFAEB',
  success: '#067647',
  successSubtle: '#ECFDF3',
  info: '#175CD3',
  infoSubtle: '#EFF8FF',

  /** Modal backdrop. */
  scrim: 'rgba(16, 24, 40, 0.48)',
  /** Soft halo around a focused input. */
  focusRing: 'rgba(27, 127, 90, 0.16)',
  skeleton: '#EAECF0',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

// --- Typography -------------------------------------------------------------

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const typography = {
  largeTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  headline: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  subhead: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  amountLarge: { fontSize: 32, lineHeight: 38, fontWeight: '700', fontVariant: tabular },
  amount: { fontSize: 15, lineHeight: 22, fontWeight: '600', fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

// --- Spacing, radius, sizes -------------------------------------------------

/** 4-pt scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const layout = {
  /** Button / input heights. */
  control: { sm: 40, md: 48, lg: 56 },
  /** Lucide icon sizes; stroke stays 2 at every size. */
  icon: { sm: 16, md: 20, lg: 24 },
  iconStroke: 2,
  /** Minimum list row height. */
  rowMinHeight: 56,
  /** Minimum touch target (Material 48dp). */
  minTouch: 48,
  /** Side padding of a standard screen. */
  screenPadding: 16,
  /** Separators inside lists and sticky footers. */
  hairline: StyleSheet.hairlineWidth,
  /** Outline of cards, inputs, chips. */
  borderWidth: 1,
  /** Leading icon tile / avatar in a list row. */
  tile: { sm: 32, md: 40, lg: 48 },
} as const;

/** Shadows are for floating things only (sheets, FABs, toasts). */
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** Barely-there lift, e.g. the selected segment. */
  subtle: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  floating: {
    shadowColor: '#101828',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

// --- Formatting helpers -----------------------------------------------------

export const CURRENCY = 'PKR';

export interface CurrencyOption {
  code: string;
  label: string;
}

/** Shortlist an admin can pick an organization's currency from. */
export const CURRENCY_OPTIONS: readonly CurrencyOption[] = [
  { code: 'PKR', label: 'Pakistani Rupee' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'SAR', label: 'Saudi Riyal' },
  { code: 'INR', label: 'Indian Rupee' },
];

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Absolute amount in whole cents. The tiny nudge absorbs binary float error
 * (1.005 * 100 === 100.49999999999999) for 2-decimal money values.
 */
function absCents(amount: number): number {
  return Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100 + 1e-6) : 0;
}

function splitCents(cents: number): { whole: string; frac: string } {
  return {
    whole: groupThousands(String(Math.floor(cents / 100))),
    frac: String(cents % 100).padStart(2, '0'),
  };
}

/**
 * "PKR 18,000" for whole amounts, "PKR 1,250.50" when there are cents.
 * Rounds to two decimals first, so 999.999 reads "PKR 1,000".
 */
export function formatAmount(amount: number, currency: string = CURRENCY): string {
  const cents = absCents(amount);
  const { whole, frac } = splitCents(cents);
  const sign = amount < 0 && cents > 0 ? '-' : '';
  return `${sign}${currency} ${frac === '00' ? whole : `${whole}.${frac}`}`;
}

/** Always two decimals ("PKR 1,000.00"), for exports and receipts. */
export function formatAmountFixed(amount: number, currency: string = CURRENCY): string {
  const cents = absCents(amount);
  const { whole, frac } = splitCents(cents);
  const sign = amount < 0 && cents > 0 ? '-' : '';
  return `${sign}${currency} ${whole}.${frac}`;
}

/** No decimals at all, for headline KPIs ("PKR 12,500"). */
export function formatAmountShort(amount: number, currency: string = CURRENCY): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round(Math.abs(safe));
  const sign = safe < 0 && rounded > 0 ? '-' : '';
  return `${sign}${currency} ${groupThousands(String(rounded))}`;
}

/** @deprecated `formatAmount` already hides ".00"; kept for older call sites. */
export function formatAmountSmart(amount: number, currency: string = CURRENCY): string {
  return formatAmount(amount, currency);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** YYYY-MM-DD -> "10 Sep 2026" without pulling in a date library. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const month = m ? MONTHS[m - 1] : undefined;
  if (!y || !month || !d) {
    return isoDate;
  }
  return `${d} ${month} ${y}`;
}

/** "Today" / "Yesterday" / "10 Sep" (year only when it is not the current one). */
export function formatDateFriendly(isoDate: string, now: Date = new Date()): string {
  if (isoDate === toIsoDate(now)) {
    return 'Today';
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isoDate === toIsoDate(yesterday)) {
    return 'Yesterday';
  }
  const full = formatDate(isoDate);
  const suffix = ` ${now.getFullYear()}`;
  return full !== isoDate && full.endsWith(suffix) ? full.slice(0, -suffix.length) : full;
}

/** Date -> YYYY-MM-DD in local time (what `expense_date` stores). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Postgres timestamptz text -> Date, or null when unparseable. Fractional
 * seconds are cut to milliseconds first: PostgREST renders six digits and not
 * every JS engine parses them (the app ships Hermes).
 */
export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** YYYY-MM-DD -> local Date at midnight, or null when malformed. */
export function parseIsoDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}
