/**
 * Pure rules for the Wallet: the running balance is a sum, not a stored
 * counter (see supabase/migrations/20260912080000_wallet_entries.sql), so
 * every screen that shows one computes it the same way. Unit tested
 * (__tests__/walletLogic.test.ts), matching khataLogic.ts.
 */
import type { WalletEntry } from '../../types/models';

function toCents(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/** Sum of a person's wallet entries, in cents-safe arithmetic. */
export function sumBalance(entries: readonly WalletEntry[]): number {
  const cents = entries.reduce((total, entry) => total + toCents(entry.amount), 0);
  return cents / 100;
}
