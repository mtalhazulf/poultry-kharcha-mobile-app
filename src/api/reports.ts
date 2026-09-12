/**
 * Reports tab data. `report_summary` runs with the caller's privileges, so
 * RLS decides what is counted: owners/admins get the whole organization,
 * members their own expenses plus those shared with them.
 */
import { AppError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database';
import type { ReportSummary } from '../types/models';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** Upper bound for `fillDailyTotals` (about ten years of days). */
const MAX_FILLED_DAYS = 3660;

type JsonObject = { [key: string]: Json | undefined };

function asObject(value: Json | undefined): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: Json | undefined): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function toText(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

function formatUtcDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → UTC midnight in ms; null for malformed or impossible dates (2026-02-30). */
function parseIsoDate(value: string): number | null {
  if (!DATE_RE.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  const time = Date.UTC(year, month - 1, day);
  return formatUtcDate(time) === value ? time : null;
}

/** Defensive parse of the `report_summary` JSON (numeric columns may arrive as strings). */
export function parseReportSummary(data: Json): ReportSummary {
  const root = asObject(data);
  if (!root) {
    throw new AppError('unknown', 'Unexpected response from the server. Please try again.');
  }
  const byCategory: ReportSummary['byCategory'] = [];
  for (const item of asArray(root.byCategory)) {
    const row = asObject(item);
    if (row) {
      byCategory.push({
        category: toText(row.category),
        icon: typeof row.icon === 'string' ? row.icon : null,
        total: toNumber(row.total),
        count: toNumber(row.count),
      });
    }
  }
  const byMember: ReportSummary['byMember'] = [];
  for (const item of asArray(root.byMember)) {
    const row = asObject(item);
    if (row && typeof row.userId === 'string') {
      byMember.push({
        userId: row.userId,
        name: toText(row.name),
        email: toText(row.email),
        total: toNumber(row.total),
        count: toNumber(row.count),
      });
    }
  }
  const byDay: ReportSummary['byDay'] = [];
  for (const item of asArray(root.byDay)) {
    const row = asObject(item);
    if (row && typeof row.date === 'string' && parseIsoDate(row.date) !== null) {
      byDay.push({ date: row.date, total: toNumber(row.total) });
    }
  }
  return {
    total: toNumber(root.total),
    count: toNumber(root.count),
    previousTotal: toNumber(root.previousTotal),
    byCategory,
    byMember,
    byDay,
  };
}

/**
 * Totals for the organization between two dates (inclusive, `YYYY-MM-DD`).
 * A person who is not an active member gets a `permission` error.
 */
export async function getReportSummary(
  orgId: string,
  from: string,
  to: string,
): Promise<ReportSummary> {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (start === null || end === null) {
    throw new AppError('validation', 'Pick a valid date range.');
  }
  if (start > end) {
    throw new AppError('validation', 'The end date must be on or after the start date.');
  }
  const { data, error } = await supabase.rpc('report_summary', {
    p_org: orgId,
    p_from: from,
    p_to: to,
  });
  if (error) {
    throw AppError.from(error);
  }
  return parseReportSummary(data);
}

/**
 * One entry per day from `from` to `to` (inclusive), using `byDay` totals and
 * 0 for days without expenses. Empty for an invalid or reversed range.
 */
export function fillDailyTotals(
  byDay: ReportSummary['byDay'],
  from: string,
  to: string,
): ReportSummary['byDay'] {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (start === null || end === null || start > end) {
    return [];
  }
  const totals = new Map(byDay.map(day => [day.date, day.total]));
  const days: ReportSummary['byDay'] = [];
  for (let time = start; time <= end && days.length < MAX_FILLED_DAYS; time += DAY_MS) {
    const date = formatUtcDate(time);
    days.push({ date, total: totals.get(date) ?? 0 });
  }
  return days;
}
