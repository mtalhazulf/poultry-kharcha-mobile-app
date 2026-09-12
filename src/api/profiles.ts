/**
 * The signed-in person's profile, and profiles of people they share an
 * organization with (RLS: own row, or `shares_org_with`). A person can only
 * change their own display name and avatar; email follows the auth account.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import { toProfile, type Profile } from '../types/models';

const COLUMNS = 'id, email, display_name, avatar_url, created_at';
const MAX_DISPLAY_NAME_LENGTH = 80;

export async function getMyProfile(): Promise<Profile> {
  const id = await requireUserId();
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', id).single();
  if (error) {
    throw AppError.from(error);
  }
  return toProfile(data);
}

/**
 * Creates the caller's profile row if the sign-up trigger somehow didn't
 * (allowed by `profiles_insert_own`). Safe to call on every login.
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

/** An empty name is stored as null (the UI then falls back to the email). */
export async function updateMyProfile(patch: { display_name: string | null }): Promise<Profile> {
  const id = await requireUserId();
  const displayName = patch.display_name?.trim() || null;
  if (displayName && Array.from(displayName).length > MAX_DISPLAY_NAME_LENGTH) {
    throw new AppError(
      'validation',
      `Keep your name to ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
    );
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) {
    throw AppError.from(error);
  }
  return toProfile(data);
}

/** Profiles the caller may see; ids they may not see are simply missing from the result. */
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return [];
  }
  const { data, error } = await supabase.from('profiles').select(COLUMNS).in('id', unique);
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toProfile);
}
