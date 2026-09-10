/**
 * Expense data access. Every call relies on RLS for scoping: `listKharcha`
 * intentionally has no owner filter — the policy returns owned + shared rows.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import type { TablesUpdate } from '../types/database';
import { toKharcha, type Kharcha, type KharchaInput } from '../types/models';

const COLUMNS =
  'id, owner_id, amount, category, note, expense_date, receipt_path, visibility, created_at, updated_at';

export async function listKharcha(): Promise<Kharcha[]> {
  const { data, error } = await supabase
    .from('kharcha')
    .select(COLUMNS)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toKharcha);
}

export async function getKharcha(id: string): Promise<Kharcha> {
  const { data, error } = await supabase.from('kharcha').select(COLUMNS).eq('id', id).single();
  if (error) {
    throw AppError.from(error);
  }
  return toKharcha(data);
}

function validateInput(input: KharchaInput): void {
  if (!Number.isFinite(input.amount)) {
    throw new AppError('validation', 'Enter a valid amount.');
  }
  if (Math.abs(input.amount) >= 1e10) {
    throw new AppError('validation', 'Amount is too large.');
  }
  if (!input.category.trim()) {
    throw new AppError('validation', 'Pick a category.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expense_date)) {
    throw new AppError('validation', 'Pick a valid date.');
  }
}

export async function createKharcha(input: KharchaInput): Promise<Kharcha> {
  validateInput(input);
  const ownerId = await requireUserId();
  const { data, error } = await supabase
    .from('kharcha')
    .insert({
      owner_id: ownerId,
      amount: Number(input.amount.toFixed(2)),
      category: input.category.trim(),
      note: input.note?.trim() || null,
      expense_date: input.expense_date,
      visibility: input.visibility ?? 'private',
    })
    .select(COLUMNS)
    .single();
  if (error) {
    throw AppError.from(error);
  }
  return toKharcha(data);
}

export async function updateKharcha(
  id: string,
  patch: Partial<KharchaInput> & { receipt_path?: string | null },
): Promise<Kharcha> {
  const update: TablesUpdate<'kharcha'> = {};
  if (patch.amount !== undefined) {
    update.amount = Number(patch.amount.toFixed(2));
  }
  if (patch.category !== undefined) {
    update.category = patch.category.trim();
  }
  if (patch.note !== undefined) {
    update.note = patch.note?.trim() || null;
  }
  if (patch.expense_date !== undefined) {
    update.expense_date = patch.expense_date;
  }
  if (patch.visibility !== undefined) {
    update.visibility = patch.visibility;
  }
  if (patch.receipt_path !== undefined) {
    update.receipt_path = patch.receipt_path;
  }
  const { data, error } = await supabase
    .from('kharcha')
    .update(update)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) {
    // RLS silently updates zero rows for non-owners; `.single()` then yields
    // PGRST116, which we surface as a permission problem rather than "not found".
    const appErr = AppError.from(error);
    throw appErr.kind === 'not_found'
      ? new AppError('permission', 'Only the owner can edit this expense.', error)
      : appErr;
  }
  return toKharcha(data);
}

export async function deleteKharcha(id: string): Promise<void> {
  const { data, error } = await supabase.from('kharcha').delete().eq('id', id).select('id');
  if (error) {
    throw AppError.from(error);
  }
  if (!data || data.length === 0) {
    throw new AppError('permission', 'Only the owner can delete this expense.');
  }
}
