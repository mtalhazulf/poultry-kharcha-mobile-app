/**
 * Khata: a per-person running ledger with the organization, separate from
 * expenses. RLS scopes every call: any active org member reads every entry
 * (everyone's balance is visible), but only inserts/updates their own — a
 * "Borrow" entry means the person adding it borrowed from the organization,
 * so there is no approval step. Owner or an org admin can delete.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import type { Tables } from '../types/database';
import {
  toKhataEntry,
  toProfileSummary,
  type KhataEntry,
  type KhataEntryInput,
  type ProfileSummary,
} from '../types/models';

const COLUMNS =
  'id, org_id, user_id, amount, note, entry_date, created_at, updated_at, person:profiles!khata_entries_user_id_fkey(id, email, display_name, avatar_url)';

type EntryRow = Tables<'khata_entries'> & { person: ProfileSummary | null };

function toEntry(row: EntryRow): KhataEntry {
  return { ...toKhataEntry(row), person: row.person ? toProfileSummary(row.person) : null };
}

function validateInput(input: KhataEntryInput): void {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new AppError('validation', 'Enter an amount.');
  }
  if (Math.abs(input.amount) >= 1e10) {
    throw new AppError('validation', 'Amount is too large.');
  }
}

/** Every entry in the organization, newest first. */
export async function listKhataEntries(orgId: string): Promise<KhataEntry[]> {
  const { data, error } = await supabase
    .from('khata_entries')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    throw AppError.from(error);
  }
  return (data as EntryRow[]).map(toEntry);
}

/** Always for the signed-in user; positive amount = borrowed, negative = repaid. */
export async function createKhataEntry(orgId: string, input: KhataEntryInput): Promise<KhataEntry> {
  validateInput(input);
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('khata_entries')
    .insert({
      org_id: orgId,
      user_id: userId,
      amount: Number(input.amount.toFixed(2)),
      note: input.note?.trim() || null,
      entry_date: input.entryDate,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    throw AppError.from(error);
  }
  return toEntry(data as EntryRow);
}

/** Your own entry, or an org admin's. */
export async function deleteKhataEntry(id: string): Promise<void> {
  const { data, error } = await supabase.from('khata_entries').delete().eq('id', id).select('id');
  if (error) {
    throw AppError.from(error);
  }
  if (!data || data.length === 0) {
    throw new AppError('permission', 'Only the person this entry is for, or an admin, can delete it.');
  }
}
