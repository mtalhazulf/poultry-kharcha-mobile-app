/**
 * Expense types of one organization. Active members read; only owners and
 * admins write (`categories_*` RLS) — the UI hides the controls, the
 * database is the gate.
 */
import { AppError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { TablesUpdate } from '../types/database';
import { isIconKey, toCategory, type Category } from '../types/models';

const COLUMNS = 'id, org_id, name, icon, sort_order, active, created_at';
const MAX_NAME_LENGTH = 40;

function validateName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new AppError('validation', 'Type a name for the expense type.');
  }
  if (Array.from(name).length > MAX_NAME_LENGTH) {
    throw new AppError('validation', `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  return name;
}

function validateIcon(raw: string): string {
  const icon = raw.trim() || 'package';
  if (!isIconKey(icon)) {
    throw new AppError('validation', 'Pick an icon from the list.');
  }
  return icon;
}

function isDuplicateName(error: { code?: string }): boolean {
  return error.code === '23505';
}

export async function listCategories(
  orgId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<Category[]> {
  let query = supabase
    .from('categories')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .order('sort_order')
    .order('name');
  if (!opts.includeInactive) {
    query = query.eq('active', true);
  }
  const { data, error } = await query;
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toCategory);
}

/** Appended after the current last type. */
export async function addCategory(
  orgId: string,
  input: { name: string; icon: string },
): Promise<Category> {
  const name = validateName(input.name);
  const icon = validateIcon(input.icon);
  const { data: last, error: lastError } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) {
    throw AppError.from(lastError);
  }
  const { data, error } = await supabase
    .from('categories')
    .insert({ org_id: orgId, name, icon, sort_order: (last?.sort_order ?? 0) + 10 })
    .select(COLUMNS)
    .single();
  if (error) {
    if (isDuplicateName(error)) {
      throw new AppError('validation', `"${name}" already exists.`, error);
    }
    const appErr = AppError.from(error);
    throw appErr.kind === 'permission'
      ? new AppError('permission', 'Only an owner or admin can add expense types.', error)
      : appErr;
  }
  return toCategory(data);
}

export async function updateCategory(
  id: string,
  patch: { name?: string; icon?: string; active?: boolean },
): Promise<Category> {
  const update: TablesUpdate<'categories'> = {};
  if (patch.name !== undefined) {
    update.name = validateName(patch.name);
  }
  if (patch.icon !== undefined) {
    update.icon = validateIcon(patch.icon);
  }
  if (patch.active !== undefined) {
    update.active = patch.active;
  }
  const query =
    Object.keys(update).length === 0
      ? supabase.from('categories').select(COLUMNS).eq('id', id).single()
      : supabase.from('categories').update(update).eq('id', id).select(COLUMNS).single();
  const { data, error } = await query;
  if (error) {
    if (isDuplicateName(error)) {
      throw new AppError('validation', `"${update.name ?? ''}" already exists.`, error);
    }
    const appErr = AppError.from(error);
    throw appErr.kind === 'not_found' || appErr.kind === 'permission'
      ? new AppError('permission', 'Only an owner or admin can change expense types.', error)
      : appErr;
  }
  return toCategory(data);
}

/** Hard delete. Existing expenses keep their category text and frozen icon. */
export async function removeCategory(id: string): Promise<void> {
  const { data, error } = await supabase.from('categories').delete().eq('id', id).select('id');
  if (error) {
    throw AppError.from(error);
  }
  if (!data || data.length === 0) {
    throw new AppError('permission', 'Only an owner or admin can remove expense types.');
  }
}
