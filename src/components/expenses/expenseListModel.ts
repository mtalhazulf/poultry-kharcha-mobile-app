/**
 * Pure logic behind the Expenses tab: scope and filter matching, day
 * grouping, the "This month" summary and the small date/time labels. No React
 * or network code, so everything here is unit tested (__tests__/expenses.test.ts).
 */
import {
  formatDate,
  formatDateFriendly,
  parseIsoDate,
  parseTimestamp,
  toIsoDate,
} from '../../theme';
import type { Kharcha, KharchaWithOwner, ProfileSummary } from '../../types/models';

// --- Scope and filters --------------------------------------------------------

/** All (everyone in the organization) / Mine. */
export type ExpenseScope = 'all' | 'mine';

export type ExpensePeriod = 'this_month' | 'last_month' | 'last_90_days' | 'all_time';

export interface ExpenseFilters {
  period: ExpensePeriod;
  /** Expense type names. Empty means every type. */
  categories: string[];
  /** Owner user ids (admins only). Empty means everyone. */
  people: string[];
}

export const DEFAULT_EXPENSE_FILTERS: ExpenseFilters = {
  period: 'all_time',
  categories: [],
  people: [],
};

export const PERIOD_OPTIONS: ReadonlyArray<{ value: ExpensePeriod; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'all_time', label: 'All time' },
];

export interface DateRange {
  /** Inclusive, YYYY-MM-DD. */
  from: string;
  /** Inclusive, YYYY-MM-DD. */
  to: string;
}

/** Local-time bounds for a period, or null for all time. */
export function periodRange(period: ExpensePeriod, now: Date): DateRange | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (period) {
    case 'this_month':
      // Day 0 of the next month is the last day of this one.
      return { from: toIsoDate(new Date(y, m, 1)), to: toIsoDate(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) };
    case 'last_90_days':
      return { from: toIsoDate(new Date(y, m, d - 89)), to: toIsoDate(new Date(y, m, d)) };
    case 'all_time':
      return null;
  }
}

/** Filters that differ from the defaults (drives the dot on the filter button). */
export function activeFilterCount(filters: ExpenseFilters): number {
  return (
    (filters.period !== DEFAULT_EXPENSE_FILTERS.period ? 1 : 0) +
    (filters.categories.length > 0 ? 1 : 0) +
    (filters.people.length > 0 ? 1 : 0)
  );
}

export interface ScopeContext {
  scope: ExpenseScope;
  userId: string;
  isAdmin: boolean;
}

export function matchesScope(item: Kharcha, { scope, userId }: ScopeContext): boolean {
  switch (scope) {
    case 'all':
      return true;
    case 'mine':
      return item.owner_id === userId;
  }
}

/** Display name, else email, else "Former member" (profile no longer readable). */
export function personName(profile: ProfileSummary | null | undefined): string {
  return profile?.display_name?.trim() || profile?.email || 'Former member';
}

/** Every whitespace-separated term must appear in the type, note or person. */
export function matchesSearch(item: KharchaWithOwner, search: string, userId: string): boolean {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return true;
  }
  const haystack = [
    item.category,
    item.note ?? '',
    personName(item.owner),
    item.owner?.email ?? '',
    item.owner_id === userId ? 'you' : '',
  ]
    .join('\n')
    .toLowerCase();
  return terms.every(term => haystack.includes(term));
}

export interface BaseFilterOptions extends ScopeContext {
  filters: ExpenseFilters;
}

/** Scope, expense types and people: what the "This month" summary describes. */
export function applyBaseFilters<T extends Kharcha>(
  items: readonly T[],
  { filters, ...scope }: BaseFilterOptions,
): T[] {
  const categories = filters.categories.length > 0 ? new Set(filters.categories) : null;
  const people = filters.people.length > 0 ? new Set(filters.people) : null;
  return items.filter(
    item =>
      matchesScope(item, scope) &&
      (!categories || categories.has(item.category)) &&
      (!people || people.has(item.owner_id)),
  );
}

export interface PeriodSearchOptions {
  period: ExpensePeriod;
  search: string;
  userId: string;
  now: Date;
}

export function applyPeriodAndSearch<T extends KharchaWithOwner>(
  items: readonly T[],
  { period, search, userId, now }: PeriodSearchOptions,
): T[] {
  const range = periodRange(period, now);
  return items.filter(
    item =>
      (!range || (item.expense_date >= range.from && item.expense_date <= range.to)) &&
      matchesSearch(item, search, userId),
  );
}

export interface ExpenseQuery extends BaseFilterOptions {
  search: string;
  now: Date;
}

/** Everything the list shows: base filters plus period and search. */
export function filterExpenses<T extends KharchaWithOwner>(
  items: readonly T[],
  query: ExpenseQuery,
): T[] {
  return applyPeriodAndSearch(applyBaseFilters(items, query), {
    period: query.filters.period,
    search: query.search,
    userId: query.userId,
    now: query.now,
  });
}

export interface TypeOption {
  name: string;
  icon: string | null;
}

/** The organization's types in their order, then retired types still on expenses (A–Z). */
export function typeOptionsFor(
  categories: ReadonlyArray<{ name: string; icon: string }>,
  items: readonly Kharcha[],
): TypeOption[] {
  const seen = new Set<string>();
  const options: TypeOption[] = [];
  for (const category of categories) {
    if (!seen.has(category.name)) {
      seen.add(category.name);
      options.push({ name: category.name, icon: category.icon });
    }
  }
  const extra = new Map<string, string | null>();
  for (const item of items) {
    if (!seen.has(item.category) && !extra.has(item.category)) {
      extra.set(item.category, item.category_icon);
    }
  }
  const retired = [...extra.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [name, icon] of retired) {
    options.push({ name, icon });
  }
  return options;
}

// --- Totals, grouping, summary ---------------------------------------------------

function toCents(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/** Sum in whole cents so 0.1 + 0.2 stays 0.3. */
export function sumAmounts(items: ReadonlyArray<{ amount: number }>): number {
  let cents = 0;
  for (const item of items) {
    cents += toCents(item.amount);
  }
  return cents / 100;
}

export interface ExpenseSection<T extends Kharcha = KharchaWithOwner> {
  /** YYYY-MM-DD */
  key: string;
  /** "Today", "Yesterday", "Tue, 8 Sep". */
  title: string;
  total: number;
  data: T[];
}

/** Newest day first; rows keep their incoming order within a day. */
export function groupByDay<T extends Kharcha>(
  items: readonly T[],
  now: Date = new Date(),
): ExpenseSection<T>[] {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const list = byDate.get(item.expense_date);
    if (list) {
      list.push(item);
    } else {
      byDate.set(item.expense_date, [item]);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, data]) => ({
      key: date,
      title: formatDayTitle(date, now),
      total: sumAmounts(data),
      data,
    }));
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface SpendDelta {
  direction: DeltaDirection;
  /** Whole percent change; null when there is nothing to compare with. */
  percent: number | null;
}

export function spendDelta(current: number, previous: number): SpendDelta {
  const cur = toCents(current);
  const prev = toCents(previous);
  if (cur === prev) {
    return { direction: 'flat', percent: prev === 0 ? null : 0 };
  }
  const direction: DeltaDirection = cur > prev ? 'up' : 'down';
  if (prev <= 0) {
    return { direction, percent: null };
  }
  return { direction, percent: Math.round((Math.abs(cur - prev) / prev) * 100) };
}

/** Badge copy for a delta, or null when it should not be shown. */
export function describeDelta(
  delta: SpendDelta,
): { label: string; accessibilityLabel: string } | null {
  if (delta.percent === null) {
    return null;
  }
  if (delta.direction === 'flat') {
    return {
      label: 'Same as last month',
      accessibilityLabel: 'Same as the same days last month',
    };
  }
  const shown =
    delta.percent === 0 ? '<1%' : delta.percent > 999 ? '>999%' : `${delta.percent}%`;
  const spoken =
    delta.percent === 0
      ? 'less than 1%'
      : delta.percent > 999
      ? 'more than 999%'
      : `${delta.percent}%`;
  return {
    label: `${shown} vs last month`,
    accessibilityLabel: `${
      delta.direction === 'up' ? 'Up' : 'Down'
    } ${spoken} compared with the same days last month`,
  };
}

export const SPARKLINE_DAYS = 30;

export interface MonthSummary {
  /** Everything dated in the current calendar month. */
  total: number;
  count: number;
  /** Last month from its 1st to the same day of the month (clamped to its length). */
  previousTotal: number;
  delta: SpendDelta;
  /** One entry per day, oldest first, ending today. */
  daily: { date: string; total: number }[];
}

export function summarizeMonth(items: readonly Kharcha[], now: Date = new Date()): MonthSummary {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const thisFrom = toIsoDate(new Date(y, m, 1));
  const thisTo = toIsoDate(new Date(y, m + 1, 0));
  const lastMonthLength = new Date(y, m, 0).getDate();
  const prevFrom = toIsoDate(new Date(y, m - 1, 1));
  const prevTo = toIsoDate(new Date(y, m - 1, Math.min(d, lastMonthLength)));
  const dailyFrom = toIsoDate(new Date(y, m, d - (SPARKLINE_DAYS - 1)));
  const today = toIsoDate(new Date(y, m, d));

  let totalCents = 0;
  let count = 0;
  let prevCents = 0;
  const dailyCents = new Map<string, number>();
  for (const item of items) {
    const date = item.expense_date;
    const cents = toCents(item.amount);
    if (date >= thisFrom && date <= thisTo) {
      totalCents += cents;
      count += 1;
    }
    if (date >= prevFrom && date <= prevTo) {
      prevCents += cents;
    }
    if (date >= dailyFrom && date <= today) {
      dailyCents.set(date, (dailyCents.get(date) ?? 0) + cents);
    }
  }

  const daily: MonthSummary['daily'] = [];
  for (let offset = SPARKLINE_DAYS - 1; offset >= 0; offset -= 1) {
    const date = toIsoDate(new Date(y, m, d - offset));
    daily.push({ date, total: (dailyCents.get(date) ?? 0) / 100 });
  }

  const total = totalCents / 100;
  const previousTotal = prevCents / 100;
  return { total, count, previousTotal, delta: spendDelta(total, previousTotal), daily };
}

// --- Row copy -----------------------------------------------------------------

/** "3:45 PM" in local time, or null for a malformed timestamp. */
export function formatTime(timestamp: string): string | null {
  // `created_at` arrives from PostgREST with six fractional digits, which not
  // every JS engine parses: parseTimestamp trims them first.
  const date = parseTimestamp(timestamp);
  if (!date) {
    return null;
  }
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/**
 * Second line of a row. With a note: the note, plus the person when it is
 * someone else's expense. Without: "You" or the person, plus the time added.
 * Kept as two strings so the note stays its own text element.
 */
export function expenseSubtitle(
  item: KharchaWithOwner,
  userId: string,
): { primary: string; secondary: string | null } {
  const note = item.note?.trim();
  const mine = item.owner_id === userId;
  const person = mine ? 'You' : personName(item.owner);
  if (note) {
    return { primary: note, secondary: mine ? null : person };
  }
  return { primary: person, secondary: formatTime(item.created_at) };
}

// --- Dates --------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function weekdayOf(isoDate: string): string | null {
  const date = parseIsoDate(isoDate);
  return date ? WEEKDAYS[date.getDay()] ?? null : null;
}

/** "Today", "Yesterday", "Tue, 8 Sep", or "Mon, 8 Sep 2025" for another year. */
export function formatDayTitle(isoDate: string, now: Date = new Date()): string {
  const friendly = formatDateFriendly(isoDate, now);
  if (friendly === 'Today' || friendly === 'Yesterday') {
    return friendly;
  }
  const weekday = weekdayOf(isoDate);
  return weekday ? `${weekday}, ${friendly}` : friendly;
}

/** "Sat, 12 Sep 2026". */
export function formatLongDate(isoDate: string): string {
  const weekday = weekdayOf(isoDate);
  const full = formatDate(isoDate);
  return weekday ? `${weekday}, ${full}` : full;
}

/** "today at 3:45 PM", "yesterday at 9:05 AM", "on 8 Sep at 6:00 PM". */
export function formatSavedAt(timestamp: string | null, now: Date = new Date()): string | null {
  if (!timestamp) {
    return null;
  }
  const date = parseTimestamp(timestamp);
  const time = formatTime(timestamp);
  if (!date || !time) {
    return null;
  }
  const day = formatDateFriendly(toIsoDate(date), now);
  const when = day === 'Today' ? 'today' : day === 'Yesterday' ? 'yesterday' : `on ${day}`;
  return `${when} at ${time}`;
}
