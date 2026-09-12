/**
 * Home-screen widget: pure logic (view preference, row formatting) plus the
 * data load for the recent-entries view. Kept separate from the JSX widget
 * components (QuickAddWidget/RecentEntriesWidget) and the task handler that
 * wires them up, so this half is unit-testable like the rest of the app's
 * pure logic modules (expenseListModel.ts, teamLogic.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMyMemberships } from '../api/organizations';
import { listKharcha } from '../api/kharcha';
import { activeOrgStorageKey, pickActiveMembership } from '../context/OrgProvider';
import { requireUserId } from '../lib/supabase';
import { CURRENCY, formatAmount } from '../theme';
import type { KharchaWithOwner } from '../types/models';

/** Must match the Kotlin `RNWidgetProvider` subclass name (android/.../widget/MpsExpenseWidget.kt). */
export const WIDGET_NAME = 'MpsExpenseWidget';

export type WidgetView = 'quickAdd' | 'recent';

const WIDGET_VIEW_KEY = 'mps:widget-view:v1';
const MAX_ROWS = 5;
const HEADER_DP = 36;
const ROW_DP = 36;

export function isWidgetView(value: string | null): value is WidgetView {
  return value === 'quickAdd' || value === 'recent';
}

/** The Settings-chosen default; 'quickAdd' until the person picks otherwise. */
export async function getWidgetView(): Promise<WidgetView> {
  try {
    const stored = await AsyncStorage.getItem(WIDGET_VIEW_KEY);
    return isWidgetView(stored) ? stored : 'quickAdd';
  } catch {
    return 'quickAdd';
  }
}

export async function setWidgetView(view: WidgetView): Promise<void> {
  await AsyncStorage.setItem(WIDGET_VIEW_KEY, view);
}

export interface WidgetRow {
  id: string;
  title: string;
  subtitle: string;
  amountText: string;
  /** Opens ExpenseDetail via the app's kharcha:// deep link. */
  uri: string;
}

/** One recent-entry row. */
export function toWidgetRow(kharcha: KharchaWithOwner, currency: string): WidgetRow {
  const person = kharcha.owner?.display_name?.trim() || kharcha.owner?.email || '';
  const note = kharcha.note?.trim();
  return {
    id: kharcha.id,
    title: kharcha.category,
    subtitle: [note, person].filter(Boolean).join(' · ') || person,
    amountText: formatAmount(kharcha.amount, currency || CURRENCY),
    uri: `kharcha://expense/${kharcha.id}`,
  };
}

/** How many rows fit a widget of this height (a header row plus fixed-height rows), capped at 5. */
export function rowsForHeight(heightDp: number): number {
  const fit = Math.floor((heightDp - HEADER_DP) / ROW_DP);
  return Math.min(MAX_ROWS, Math.max(1, fit));
}

/** Same "preferred if active, else first active" fallback OrgProvider itself uses. */
async function resolveActiveOrg(userId: string): Promise<{ id: string; currency: string } | null> {
  const preferredOrgId = await AsyncStorage.getItem(activeOrgStorageKey(userId));
  const memberships = await listMyMemberships();
  const membership = pickActiveMembership(memberships, preferredOrgId);
  return membership ? { id: membership.org_id, currency: membership.organization.currency } : null;
}

/**
 * Up to `maxRows` most recent org expenses for the recent-entries view.
 * Null means "could not load" (offline, no session) — the caller shows a
 * fallback rather than treating it the same as a genuinely empty list.
 */
export async function loadRecentRows(maxRows: number): Promise<WidgetRow[] | null> {
  try {
    const userId = await requireUserId();
    const org = await resolveActiveOrg(userId);
    if (!org) {
      return [];
    }
    const items = await listKharcha(org.id);
    return items.slice(0, maxRows).map(item => toWidgetRow(item, org.currency));
  } catch {
    return null;
  }
}
