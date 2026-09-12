/**
 * Expense data access. RLS scopes every call: every active member of the
 * organization sees all of its expenses. Only the owner (with active access)
 * edits; the owner or an admin deletes.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import type { Tables, TablesUpdate } from '../types/database';
import {
  isIconKey,
  toKharcha,
  toProfileSummary,
  type Kharcha,
  type KharchaInput,
  type KharchaWithOwner,
  type ProfileSummary,
} from '../types/models';

const COLUMNS =
  'id, org_id, owner_id, amount, category, category_icon, note, expense_date, receipt_path, created_at, updated_at';

/** Same columns plus the owner's profile through the `kharcha_owner_id_fkey` foreign key. */
const COLUMNS_WITH_OWNER =
  'id, org_id, owner_id, amount, category, category_icon, note, expense_date, receipt_path, created_at, updated_at, owner:profiles!kharcha_owner_id_fkey(id, email, display_name, avatar_url)';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toKharchaWithOwner(
  row: Tables<'kharcha'> & { owner: ProfileSummary | null },
): KharchaWithOwner {
  return { ...toKharcha(row), owner: row.owner ? toProfileSummary(row.owner) : null };
}

/** Newest expense date first, then newest created. */
export async function listKharcha(orgId: string): Promise<KharchaWithOwner[]> {
  const { data, error } = await supabase
    .from('kharcha')
    .select(COLUMNS_WITH_OWNER)
    .eq('org_id', orgId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toKharchaWithOwner);
}

export async function getKharcha(id: string): Promise<KharchaWithOwner> {
  const { data, error } = await supabase
    .from('kharcha')
    .select(COLUMNS_WITH_OWNER)
    .eq('id', id)
    .single();
  if (error) {
    throw AppError.from(error);
  }
  return toKharchaWithOwner(data);
}

function validateInput(input: Partial<KharchaInput>): void {
  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount)) {
      throw new AppError('validation', 'Enter a valid amount.');
    }
    if (Math.abs(input.amount) >= 1e10) {
      throw new AppError('validation', 'Amount is too large.');
    }
  }
  if (input.category !== undefined && !input.category.trim()) {
    throw new AppError('validation', 'Pick an expense type.');
  }
  if (input.expenseDate !== undefined && !DATE_RE.test(input.expenseDate)) {
    throw new AppError('validation', 'Pick a valid date.');
  }
}

/** Unknown/legacy icons are stored as null (the UI shows the generic package icon). */
function iconKeyOrNull(icon: string | null | undefined): string | null {
  return icon && isIconKey(icon) ? icon : null;
}

export async function createKharcha(orgId: string, input: KharchaInput): Promise<Kharcha> {
  validateInput(input);
  const ownerId = await requireUserId();
  const { data, error } = await supabase
    .from('kharcha')
    .insert({
      org_id: orgId,
      owner_id: ownerId,
      amount: Number(input.amount.toFixed(2)),
      category: input.category.trim(),
      category_icon: iconKeyOrNull(input.categoryIcon),
      note: input.note?.trim() || null,
      expense_date: input.expenseDate,
      receipt_path: input.receiptPath ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    const appErr = AppError.from(error);
    throw appErr.kind === 'permission'
      ? new AppError(
          'permission',
          'Your access to this organization is not active, so you cannot add expenses.',
          error,
        )
      : appErr;
  }
  return toKharcha(data);
}

/** Updates only the fields present in `input`. Owner only. */
export async function updateKharcha(id: string, input: Partial<KharchaInput>): Promise<Kharcha> {
  validateInput(input);
  const update: TablesUpdate<'kharcha'> = {};
  if (input.amount !== undefined) {
    update.amount = Number(input.amount.toFixed(2));
  }
  if (input.category !== undefined) {
    update.category = input.category.trim();
  }
  if (input.categoryIcon !== undefined) {
    update.category_icon = iconKeyOrNull(input.categoryIcon);
  }
  if (input.note !== undefined) {
    update.note = input.note?.trim() || null;
  }
  if (input.expenseDate !== undefined) {
    update.expense_date = input.expenseDate;
  }
  if (input.receiptPath !== undefined) {
    update.receipt_path = input.receiptPath;
  }

  const query =
    Object.keys(update).length === 0
      ? supabase.from('kharcha').select(COLUMNS).eq('id', id).single()
      : supabase.from('kharcha').update(update).eq('id', id).select(COLUMNS).single();
  const { data, error } = await query;
  if (error) {
    // RLS silently matches zero rows for non-owners; `.single()` then yields
    // PGRST116, which is a permission problem from the user's point of view.
    const appErr = AppError.from(error);
    throw appErr.kind === 'not_found' || appErr.kind === 'permission'
      ? new AppError('permission', 'Only the person who added this expense can edit it.', error)
      : appErr;
  }
  return toKharcha(data);
}

/** Owner or an owner/admin of the organization. */
export async function deleteKharcha(id: string): Promise<void> {
  const { data, error } = await supabase.from('kharcha').delete().eq('id', id).select('id');
  if (error) {
    throw AppError.from(error);
  }
  if (!data || data.length === 0) {
    throw new AppError(
      'permission',
      'Only the person who added this expense, or an admin, can delete it.',
    );
  }
}
