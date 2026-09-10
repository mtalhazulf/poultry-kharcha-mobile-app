/**
 * Design tokens. Tuned for users who may not read fluently: large type, big
 * touch targets (56dp), one strong accent colour, high contrast.
 * Keep every screen on these — no ad-hoc hex values.
 */
export const colors = {
  primary: '#1B7F5A',
  primaryDark: '#145F43',
  primarySoft: '#E1F3EA',
  accent: '#F2A93B',
  background: '#F4F6F8',
  surface: '#FFFFFF',
  border: '#E1E5EA',
  text: '#15191E',
  textMuted: '#5F6B78',
  textOnPrimary: '#FFFFFF',
  danger: '#C93B3B',
  dangerSoft: '#FBE7E7',
  success: '#2E8B57',
  warning: '#9A6A0F',
  warningSoft: '#FFF4D6',
  shared: '#2F63C9',
  sharedSoft: '#E6EEFB',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/** Minimum height for anything tappable. */
export const touch = {
  min: 56,
  fab: 64,
} as const;

export const typography = {
  display: { fontSize: 40, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 18, fontWeight: '400' as const, color: colors.text },
  bodyStrong: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  label: { fontSize: 15, fontWeight: '600' as const, color: colors.textMuted },
  caption: { fontSize: 14, fontWeight: '400' as const, color: colors.textMuted },
  amount: { fontSize: 22, fontWeight: '800' as const, color: colors.text },
  button: { fontSize: 18, fontWeight: '700' as const },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  fab: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
} as const;

export const CURRENCY = 'PKR';

export function formatAmount(amount: number, currency = CURRENCY): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [whole = '0', frac = '00'] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}${currency} ${grouped}.${frac}`;
}

/** Amount without the decimals for headline numbers (e.g. "PKR 12,500"). */
export function formatAmountShort(amount: number, currency = CURRENCY): string {
  const rounded = Math.round(Math.abs(amount));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}${currency} ${grouped}`;
}

/** Whole amounts without decimals ("PKR 12,500"), fractional ones with ("PKR 1,250.50"). */
export function formatAmountSmart(amount: number, currency = CURRENCY): string {
  return Number.isInteger(Math.round(amount * 100) / 100) && Number.isInteger(amount)
    ? formatAmountShort(amount, currency)
    : formatAmount(amount, currency);
}

/** YYYY-MM-DD -> "10 Sep 2026" without pulling in a date library. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) {
    return isoDate;
  }
  const months = [
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
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

/** "Today" / "Yesterday" / "10 Sep" — what a person would say, not a timestamp. */
export function formatDateFriendly(isoDate: string, now: Date = new Date()): string {
  const today = toIsoDate(now);
  if (isoDate === today) {
    return 'Today';
  }
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isoDate === toIsoDate(y)) {
    return 'Yesterday';
  }
  const full = formatDate(isoDate);
  // Drop the year when it is the current one.
  return full.endsWith(String(now.getFullYear())) ? full.slice(0, -5) : full;
}

/** Date -> YYYY-MM-DD in local time (what `expense_date` stores). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
