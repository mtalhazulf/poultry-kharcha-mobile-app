/**
 * Pure rules for the Khata tab: per-person running balances and each
 * person's entry history. No React or network code, so this is unit tested
 * (__tests__/khataLogic.test.ts), matching teamLogic.ts/reportMath.ts.
 */
import { personName } from '../team/teamLogic';
import type { KhataEntry, OrgMember } from '../../types/models';

export interface PersonBalance {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Sum of that person's entries; positive = they owe the organization, negative = the organization owes them. */
  balance: number;
}

function toCents(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/** One row per active org member (including those with no entries yet), highest balance first, then name. */
export function personBalances(
  entries: readonly KhataEntry[],
  members: readonly OrgMember[],
): PersonBalance[] {
  const centsByUser = new Map<string, number>();
  for (const entry of entries) {
    centsByUser.set(entry.user_id, (centsByUser.get(entry.user_id) ?? 0) + toCents(entry.amount));
  }
  return members
    .filter(member => member.status === 'active')
    .map(member => ({
      userId: member.user_id,
      name: personName(member.profile),
      email: member.profile.email,
      avatarUrl: member.profile.avatar_url,
      balance: (centsByUser.get(member.user_id) ?? 0) / 100,
    }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}

/** One person's entries, newest entry date first, then newest created. */
export function entriesForPerson(entries: readonly KhataEntry[], userId: string): KhataEntry[] {
  return entries
    .filter(entry => entry.user_id === userId)
    .slice()
    .sort((a, b) => {
      if (a.entry_date !== b.entry_date) {
        return a.entry_date < b.entry_date ? 1 : -1;
      }
      return a.created_at < b.created_at ? 1 : -1;
    });
}
