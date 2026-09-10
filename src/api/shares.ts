import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import {
  toProfile,
  type KharchaShare,
  type KharchaShareWithProfile,
} from '../types/models';

/** Everyone an expense is shared with. RLS lets the owner and each recipient see this. */
export async function listSharesForKharcha(kharchaId: string): Promise<KharchaShareWithProfile[]> {
  const { data, error } = await supabase
    .from('kharcha_shares')
    .select(
      'kharcha_id, shared_with, shared_by, created_at, profile:profiles!kharcha_shares_shared_with_fkey(id, email, email_lower, display_name, avatar_url, created_at)',
    )
    .eq('kharcha_id', kharchaId)
    .order('created_at');
  if (error) {
    throw AppError.from(error);
  }
  return data.map(row => ({
    kharcha_id: row.kharcha_id,
    shared_with: row.shared_with,
    shared_by: row.shared_by,
    created_at: row.created_at,
    profile: toProfile(row.profile),
  }));
}

/**
 * Share with one or more users. Owner-only via `shares_insert`; also flips
 * `visibility` to 'shared' so the dashboard can badge the row.
 */
export async function shareKharcha(kharchaId: string, userIds: string[]): Promise<KharchaShare[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return [];
  }
  const me = await requireUserId();
  const rows = unique
    .filter(id => id !== me)
    .map(id => ({ kharcha_id: kharchaId, shared_with: id, shared_by: me }));
  const { data, error } = await supabase
    .from('kharcha_shares')
    .upsert(rows, { onConflict: 'kharcha_id,shared_with', ignoreDuplicates: true })
    .select('kharcha_id, shared_with, shared_by, created_at');
  if (error) {
    throw AppError.from(error);
  }
  const { error: visError } = await supabase
    .from('kharcha')
    .update({ visibility: 'shared' })
    .eq('id', kharchaId);
  if (visError) {
    throw AppError.from(visError);
  }
  return data;
}

/** Revoke one recipient. If nobody is left, visibility returns to 'private'. */
export async function unshareKharcha(kharchaId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('kharcha_shares')
    .delete()
    .eq('kharcha_id', kharchaId)
    .eq('shared_with', userId);
  if (error) {
    throw AppError.from(error);
  }
  const { count, error: countError } = await supabase
    .from('kharcha_shares')
    .select('kharcha_id', { count: 'exact', head: true })
    .eq('kharcha_id', kharchaId);
  if (countError) {
    throw AppError.from(countError);
  }
  if ((count ?? 0) === 0) {
    const { error: visError } = await supabase
      .from('kharcha')
      .update({ visibility: 'private' })
      .eq('id', kharchaId);
    if (visError) {
      throw AppError.from(visError);
    }
  }
}
