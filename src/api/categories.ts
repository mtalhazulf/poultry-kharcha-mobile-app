/**
 * Org-wide expense categories. Everyone can read; only admins can write
 * (`categories_admin_write` RLS) — the UI hides the controls but the
 * database is the gate.
 */
import { AppError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { toCategory, type Category } from '../types/models';

const COLUMNS = 'id, name, emoji, sort_order, active, created_at';

export async function listCategories(
  options: { includeInactive?: boolean } = {},
): Promise<Category[]> {
  let query = supabase.from('categories').select(COLUMNS).order('sort_order').order('name');
  if (!options.includeInactive) {
    query = query.eq('active', true);
  }
  const { data, error } = await query;
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toCategory);
}

export async function addCategory(input: { name: string; emoji: string }): Promise<Category> {
  const name = input.name.trim();
  if (!name) {
    throw new AppError('validation', 'Type a name for the expense type.');
  }
  const { data: last } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, emoji: input.emoji || '📦', sort_order: (last?.sort_order ?? 0) + 10 })
    .select(COLUMNS)
    .single();
  if (error) {
    const appErr = AppError.from(error);
    throw appErr.kind === 'validation'
      ? new AppError('validation', `"${name}" already exists.`, error)
      : appErr;
  }
  return toCategory(data);
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'emoji' | 'active' | 'sort_order'>>,
): Promise<Category> {
  const update = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
  const { data, error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) {
    const appErr = AppError.from(error);
    throw appErr.kind === 'not_found'
      ? new AppError('permission', 'Only an admin can change expense types.', error)
      : appErr;
  }
  return toCategory(data);
}

/** Hard delete. Existing expenses keep their category text + frozen icon. */
export async function removeCategory(id: string): Promise<void> {
  const { data, error } = await supabase.from('categories').delete().eq('id', id).select('id');
  if (error) {
    throw AppError.from(error);
  }
  if (!data || data.length === 0) {
    throw new AppError('permission', 'Only an admin can remove expense types.');
  }
}
