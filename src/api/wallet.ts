/**
 * Wallet: a per-person, display-only running balance. RLS scopes reads to
 * the person themselves or an org admin. Expense-linked entries are written
 * only by the `sync_wallet_entry_for_kharcha` trigger on `kharcha`, never by
 * the client — the only client write here is an admin top-up.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import { toWalletEntry, type WalletEntry, type WalletTopUpInput } from '../types/models';

const COLUMNS = 'id, org_id, user_id, amount, note, kharcha_id, created_by, entry_date, created_at';

/** One person's entries, newest first. */
export async function listWalletEntries(orgId: string, userId: string): Promise<WalletEntry[]> {
  const { data, error } = await supabase
    .from('wallet_entries')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toWalletEntry);
}

/** Admin-only per RLS; always a positive amount. */
export async function createWalletTopUp(
  orgId: string,
  userId: string,
  input: WalletTopUpInput,
): Promise<WalletEntry> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError('validation', 'Enter an amount greater than 0.');
  }
  const createdBy = await requireUserId();
  const { data, error } = await supabase
    .from('wallet_entries')
    .insert({
      org_id: orgId,
      user_id: userId,
      amount: Number(input.amount.toFixed(2)),
      note: input.note?.trim() || null,
      created_by: createdBy,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    const appErr = AppError.from(error);
    throw appErr.kind === 'permission'
      ? new AppError('permission', 'Only an admin can add funds to a wallet.', error)
      : appErr;
  }
  return toWalletEntry(data);
}
