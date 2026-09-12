/**
 * Pure helpers for the Reports tab: month ranges, the comparison period,
 * spend deltas, shares of a total and the daily bar chart. No React here so
 * the rules are unit-tested (__tests__/reportMath.test.ts).
 */
import { formatAmount, toIsoDate } from '../../theme';

/** A calendar month in local time. `month` is 0-11 like `Date#getMonth`. */
export interface MonthKey {
  year: number;
  month: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTH_SHORT = [
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

export function monthOf(date: Date): MonthKey {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** `delta` months later (negative for earlier); rolls over years. */
export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  return monthOf(new Date(key.year, key.month + delta, 1));
}

/** Negative when `a` is before `b`, 0 for the same month. */
export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

/** Stable id, e.g. `2026-09`. */
export function monthId(key: MonthKey): string {
  return `${key.year}-${String(key.month + 1).padStart(2, '0')}`;
}

/** "September 2026". */
export function monthLabel(key: MonthKey): string {
  return `${MONTH_NAMES[key.month] ?? ''} ${key.year}`.trim();
}

export function daysInMonth(key: MonthKey): number {
  return new Date(key.year, key.month + 1, 0).getDate();
}

/** First and last day of the month as `YYYY-MM-DD` (inclusive). */
export function monthRange(key: MonthKey): { from: string; to: string } {
  return {
    from: toIsoDate(new Date(key.year, key.month, 1)),
    to: toIsoDate(new Date(key.year, key.month, daysInMonth(key))),
  };
}

/**
 * Days that count towards the daily average: every day of a past month, the
 * days so far (today included) for the current month, none for a future month.
 */
export function elapsedDays(key: MonthKey, today: Date): number {
  const order = compareMonths(key, monthOf(today));
  if (order < 0) {
    return daysInMonth(key);
  }
  return order > 0 ? 0 : today.getDate();
}

export interface ComparisonPeriod {
  from: string;
  to: string;
  /** "August" for a whole month, "1–12 Aug" for part of one. */
  label: string;
  wholeMonth: boolean;
}

/**
 * The like-for-like stretch of the previous month: the whole month when
 * looking back, and day 1 up to today's day (capped at that month's length)
 * for the month in progress, so a half-finished month is never compared with
 * a full one.
 */
export function comparisonPeriod(key: MonthKey, today: Date): ComparisonPeriod {
  const previous = shiftMonth(key, -1);
  const previousDays = daysInMonth(previous);
  const inProgress = compareMonths(key, monthOf(today)) === 0;
  const span = inProgress ? Math.min(Math.max(today.getDate(), 1), previousDays) : previousDays;
  const wholeMonth = span >= previousDays;
  const short = MONTH_SHORT[previous.month] ?? '';
  let label: string;
  if (wholeMonth) {
    label = MONTH_NAMES[previous.month] ?? short;
  } else if (span === 1) {
    label = `1 ${short}`;
  } else {
    label = `1–${span} ${short}`;
  }
  return {
    from: toIsoDate(new Date(previous.year, previous.month, 1)),
    to: toIsoDate(new Date(previous.year, previous.month, span)),
    label,
    wholeMonth,
  };
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface SpendDelta {
  direction: DeltaDirection;
  /** Whole percent, always positive; null when there was no spend to compare with. */
  percent: number | null;
}

/** Change from `previous` to `current`. Changes that round to 0% are flat. */
export function spendDelta(current: number, previous: number): SpendDelta {
  const now = finite(current);
  const before = finite(previous);
  if (before <= 0) {
    return now > 0 ? { direction: 'up', percent: null } : { direction: 'flat', percent: 0 };
  }
  const change = ((now - before) / before) * 100;
  const percent = Math.round(Math.abs(change));
  if (percent === 0) {
    return { direction: 'flat', percent: 0 };
  }
  return { direction: change > 0 ? 'up' : 'down', percent };
}

/** "12%", capped at ">999%". */
export function formatDeltaPercent(percent: number): string {
  return percent > 999 ? '>999%' : `${Math.max(0, Math.round(percent))}%`;
}

/** `part` as a percentage of `total`, clamped to 0-100 (0 when the total is not positive). */
export function shareOf(part: number, total: number): number {
  const p = finite(part);
  const t = finite(total);
  if (t <= 0 || p <= 0) {
    return 0;
  }
  return Math.min(100, (p / t) * 100);
}

/** "34%"; "<1%" for tiny shares and ">99%" when rounding would claim the whole. */
export function formatShare(part: number, total: number): string {
  const share = shareOf(part, total);
  if (share === 0) {
    return '0%';
  }
  if (share < 1) {
    return '<1%';
  }
  const rounded = Math.round(share);
  return rounded >= 100 && finite(part) < finite(total) ? '>99%' : `${rounded}%`;
}

export function dailyAverage(total: number, days: number): number {
  const t = finite(total);
  return days > 0 && t > 0 ? t / days : 0;
}

/** `YYYY-MM-DD` -> "12 Sep" (the input when malformed). */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  const short = month ? MONTH_SHORT[month - 1] : undefined;
  return short && day ? `${day} ${short}` : isoDate;
}

export interface ChartBar {
  date: string;
  total: number;
  /** Bar height in dp; 0 for days without spend. */
  height: number;
  highlighted: boolean;
}

export interface ChartOptions {
  /** Height of the tallest bar. */
  height: number;
  /** Floor for days that have any spend, so small days stay visible. */
  minHeight: number;
  highlightDate?: string | null;
}

/** Bar heights scaled to the busiest day. */
export function buildChartBars(
  days: ReadonlyArray<{ date: string; total: number }>,
  { height, minHeight, highlightDate = null }: ChartOptions,
): { bars: ChartBar[]; max: number } {
  const max = days.reduce((top, day) => Math.max(top, finite(day.total)), 0);
  const bars = days.map(day => {
    const total = finite(day.total);
    const scaled = max > 0 && total > 0 ? Math.round((total / max) * height) : 0;
    return {
      date: day.date,
      total,
      height: total > 0 ? Math.min(height, Math.max(minHeight, scaled)) : 0,
      highlighted: highlightDate !== null && day.date === highlightDate,
    };
  });
  return { bars, max };
}

/** One sentence set for screen readers in place of the bars. */
export function describeDailySpend(
  days: ReadonlyArray<{ date: string; total: number }>,
  { period, currency, today = null }: { period: string; currency: string; today?: string | null },
): string {
  const withSpend = days.filter(day => day.total > 0);
  const parts = [`Daily spend for ${period}.`];
  if (withSpend.length === 0) {
    parts.push('No expenses.');
    return parts.join(' ');
  }
  const peak = withSpend.reduce((top, day) => (day.total > top.total ? day : top));
  parts.push(
    `${withSpend.length} of ${days.length} ${days.length === 1 ? 'day' : 'days'} had expenses.`,
    `Highest ${formatAmount(peak.total, currency)} on ${formatDayMonth(peak.date)}.`,
  );
  const todayEntry = today ? days.find(day => day.date === today) : undefined;
  if (todayEntry) {
    parts.push(`Today ${formatAmount(todayEntry.total, currency)}.`);
  }
  return parts.join(' ');
}
