/** Shared design tokens. Keep every screen on these — no ad-hoc hex values. */
export const colors = {
  primary: '#1E6F5C',
  primaryDark: '#155245',
  primarySoft: '#E3F2EE',
  accent: '#F2A93B',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#E3E6EA',
  text: '#1B1F23',
  textMuted: '#6B7280',
  textOnPrimary: '#FFFFFF',
  danger: '#D14343',
  dangerSoft: '#FBE9E9',
  success: '#2E8B57',
  warning: '#B7791F',
  warningSoft: '#FFF6E5',
  shared: '#3B6FD4',
  sharedSoft: '#E8EFFC',
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
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textMuted },
  amount: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

export function formatAmount(amount: number, currency = 'PKR'): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [whole = '0', frac = '00'] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}${currency} ${grouped}.${frac}`;
}

/** YYYY-MM-DD -> "10 Sep 2026" without pulling in a date library. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) {
    return isoDate;
  }
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** Date -> YYYY-MM-DD in local time (what `expense_date` stores). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
