/**
 * Staff management (admin only via RLS): who may sign up (invites) and the
 * accounts that exist (profiles). Members can read the directory — it only
 * contains invited colleagues — but every write here is admin-gated.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import { toInvite, toProfile, type Invite, type Profile, type Role } from '../types/models';

const PROFILE_COLUMNS =
  'id, email, email_lower, display_name, avatar_url, role, disabled, created_at';
const INVITE_COLUMNS = 'email, role, invited_by, created_at, accepted_at';

export async function listMembers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('disabled')
    .order('role')
    .order('email_lower');
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toProfile);
}

/** Pending invitations only (accepted ones have become members). */
export async function listPendingInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select(INVITE_COLUMNS)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    throw AppError.from(error);
  }
  return data.map(toInvite);
}

export async function inviteMember(email: string, role: Role = 'member'): Promise<Invite> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AppError('validation', 'Enter a valid email address.');
  }
  const me = await requireUserId();
  const { data, error } = await supabase
    .from('invites')
    .upsert({ email: normalized, role, invited_by: me }, { onConflict: 'email' })
    .select(INVITE_COLUMNS)
    .single();
  if (error) {
    const appErr = AppError.from(error);
    throw appErr.kind === 'permission' || appErr.kind === 'not_found'
      ? new AppError('permission', 'Only an admin can invite people.', error)
      : appErr;
  }
  return toInvite(data);
}

export async function revokeInvite(email: string): Promise<void> {
  const { error } = await supabase.from('invites').delete().eq('email', email.trim().toLowerCase());
  if (error) {
    throw AppError.from(error);
  }
}

/** Disable/enable an account. Disabled users can log in but see nothing. */
export async function setMemberDisabled(id: string, disabled: boolean): Promise<Profile> {
  return updateMember(id, { disabled });
}

export async function setMemberRole(id: string, role: Role): Promise<Profile> {
  return updateMember(id, { role });
}

async function updateMember(
  id: string,
  patch: { disabled?: boolean; role?: Role },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) {
    const appErr = AppError.from(error);
    throw appErr.kind === 'not_found'
      ? new AppError('permission', 'Only an admin can change accounts.', error)
      : appErr;
  }
  return toProfile(data);
}
