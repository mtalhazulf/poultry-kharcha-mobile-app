/**
 * Viewed/read tracking for an expense. RLS lets everyone read their own row
 * (so a button can show "already read") but only the expense's owner or an
 * org admin see everyone else's — call `listKharchaViewers` only when the
 * screen already knows the caller is one of those two.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import type { Tables } from '../types/database';
import { toKharchaView, toProfileSummary, type KharchaView, type ProfileSummary } from '../types/models';

const COLUMNS =
  'id, kharcha_id, user_id, viewed_at, read_at, person:profiles!kharcha_views_user_id_fkey(id, email, display_name, avatar_url)';

type ViewRow = Tables<'kharcha_views'> & { person: ProfileSummary | null };

function toView(row: ViewRow): KharchaView {
  return { ...toKharchaView(row), person: row.person ? toProfileSummary(row.person) : null };
}

/** First open only: a no-op if this person already has a row for this expense. */
export async function markViewed(kharchaId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('kharcha_views')
    .upsert({ kharcha_id: kharchaId, user_id: userId }, { onConflict: 'kharcha_id,user_id', ignoreDuplicates: true });
  if (error) {
    throw AppError.from(error);
  }
}

/** Deliberate acknowledgment; safe to call again (just refreshes `read_at`). */
export async function markRead(kharchaId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('kharcha_views')
    .upsert(
      { kharcha_id: kharchaId, user_id: userId, read_at: new Date().toISOString() },
      { onConflict: 'kharcha_id,user_id' },
    );
  if (error) {
    throw AppError.from(error);
  }
}

/** The signed-in user's own viewed/read state for this expense, or null if never viewed. */
export async function getMyKharchaView(kharchaId: string): Promise<KharchaView | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('kharcha_views')
    .select(COLUMNS)
    .eq('kharcha_id', kharchaId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw AppError.from(error);
  }
  return data ? toView(data as ViewRow) : null;
}

/** Everyone who has viewed/read this expense, newest first. Owner/admin only — see the file doc comment. */
export async function listKharchaViewers(kharchaId: string): Promise<KharchaView[]> {
  const { data, error } = await supabase
    .from('kharcha_views')
    .select(COLUMNS)
    .eq('kharcha_id', kharchaId)
    .order('viewed_at', { ascending: false });
  if (error) {
    throw AppError.from(error);
  }
  return (data as ViewRow[]).map(toView);
}
