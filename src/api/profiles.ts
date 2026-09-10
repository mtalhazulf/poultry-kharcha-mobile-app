import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import { toProfile, type Profile } from '../types/models';

const COLUMNS = 'id, email, email_lower, display_name, avatar_url, created_at';

export async function getMyProfile(): Promise<Profile> {
  const id = await requireUserId();
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', id).single();
  if (error) {
    throw AppError.from(error);
  }
  return toProfile(data);
}

/**
 * Creates the caller's profile row if the auth trigger somehow didn't
 * (allowed by the `profiles_insert_own` policy). Safe to call on every login.
 */
export async function ensureMyProfile(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    return;
  }
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email ?? '' }, { onConflict: 'id', ignoreDuplicates: true });
  if (error && AppError.from(error).kind !== 'permission') {
    throw AppError.from(error);
  }
}

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) {
    return [];
  }
  const { data, error } = await supabase.from('profiles').select(COLUMNS).in('id', ids);
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toProfile);
}

/**
 * Share-modal search. Matches on the generated lower-cased column so the
 * trigram index is used; excludes the caller and anyone already in `exclude`.
 */
export async function searchProfilesByEmail(
  term: string,
  options: { exclude?: string[]; limit?: number } = {},
): Promise<Profile[]> {
  const query = term.trim().toLowerCase();
  if (query.length < 2) {
    return [];
  }
  const me = await requireUserId();
  const excluded = new Set([me, ...(options.exclude ?? [])]);
  // Escape LIKE wildcards typed by the user so they match literally.
  const escaped = query.replace(/[\\%_]/g, ch => `\\${ch}`);
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .ilike('email_lower', `%${escaped}%`)
    .order('email_lower')
    .limit((options.limit ?? 10) + excluded.size);
  if (error) {
    throw AppError.from(error);
  }
  return data
    .map(toProfile)
    .filter(p => !excluded.has(p.id))
    .slice(0, options.limit ?? 10);
}
