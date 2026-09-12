/**
 * Non-auth `kharcha://` deep links (e.g. a tap on the home-screen widget) can
 * arrive before the app's stage machine (see navigation/rootStage.ts) has
 * mounted a screen for them — a cold start while signed out, locked, or with
 * no active organization. This module holds the most recently seen one until
 * RootNavigator can replay it once the `app` stage mounts.
 */

export type ExpenseDeepLink =
  | { screen: 'ExpenseForm' }
  | { screen: 'ExpenseDetail'; kharchaId: string };

const EXPENSE_PATH_RE = /^kharcha:\/\/expense\/([^/?#]+)/i;

/** Parses a `kharcha://expense/...` URL; null for anything else (including auth callbacks). */
export function parseExpenseDeepLink(url: string): ExpenseDeepLink | null {
  const match = EXPENSE_PATH_RE.exec(url);
  if (!match || !match[1]) {
    return null;
  }
  const segment = decodeURIComponent(match[1]);
  return segment.toLowerCase() === 'new'
    ? { screen: 'ExpenseForm' }
    : { screen: 'ExpenseDetail', kharchaId: segment };
}

let pending: ExpenseDeepLink | null = null;

/** No-op for a URL that isn't an expense deep link (leaves any existing pending link alone). */
export function setPendingDeepLink(url: string): void {
  const parsed = parseExpenseDeepLink(url);
  if (parsed) {
    pending = parsed;
  }
}

/** Reads and clears the pending link, so it is never replayed twice. */
export function takePendingDeepLink(): ExpenseDeepLink | null {
  const link = pending;
  pending = null;
  return link;
}
