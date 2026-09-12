/**
 * People in an organization and the admin actions on them. RLS scopes the
 * read (owners/admins see every membership, members see active ones); every
 * write is an RPC that re-checks the caller is an active owner/admin. RPC
 * refusals come back as AppError with a sentence that can be shown as-is.
 */
import { AppError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import {
  isMemberStatus,
  isOrgRole,
  type OrgMember,
  type OrgRole,
  type ProfileSummary,
} from '../types/models';

const MEMBER_COLUMNS =
  'org_id, user_id, role, status, requested_at, approved_at, profile:profiles!organization_members_user_id_fkey(id, email, display_name, avatar_url)';

const ROLE_RANK: Record<OrgRole, number> = { owner: 0, admin: 1, member: 2 };

/** Display name, else email, else a placeholder. */
export function memberDisplayName(profile: ProfileSummary): string {
  return profile.display_name?.trim() || profile.email || 'Unknown member';
}

/** Owner first, then admins, then members; alphabetical within a role. */
export function compareMembers(a: OrgMember, b: OrgMember): number {
  const byRole = ROLE_RANK[a.role] - ROLE_RANK[b.role];
  if (byRole !== 0) {
    return byRole;
  }
  const an = memberDisplayName(a.profile).toLowerCase();
  const bn = memberDisplayName(b.profile).toLowerCase();
  return an < bn ? -1 : an > bn ? 1 : 0;
}

/** Everyone in the organization the caller may see (all statuses for admins). */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select(MEMBER_COLUMNS)
    .eq('org_id', orgId);
  if (error) {
    throw AppError.from(error);
  }
  const members: OrgMember[] = [];
  for (const row of data) {
    if (!isOrgRole(row.role) || !isMemberStatus(row.status)) {
      continue;
    }
    members.push({
      org_id: row.org_id,
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      requested_at: row.requested_at,
      approved_at: row.approved_at,
      profile: row.profile
        ? {
            id: row.profile.id,
            email: row.profile.email,
            display_name: row.profile.display_name,
            avatar_url: row.profile.avatar_url,
          }
        : { id: row.user_id, email: '', display_name: null, avatar_url: null },
    });
  }
  return members.sort(compareMembers);
}

/** Pending → active. */
export async function approveJoinRequest(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_join_request', { p_org: orgId, p_user: userId });
  if (error) {
    throw AppError.from(error);
  }
}

/** Deletes a pending request. */
export async function declineJoinRequest(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_join_request', { p_org: orgId, p_user: userId });
  if (error) {
    throw AppError.from(error);
  }
}

/** Not for the owner or yourself. */
export async function setMemberRole(
  orgId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', {
    p_org: orgId,
    p_user: userId,
    p_role: role,
  });
  if (error) {
    throw AppError.from(error);
  }
}

/** Turns access off/on. Not for the owner, yourself, or a pending request. */
export async function setMemberStatus(
  orgId: string,
  userId: string,
  status: 'active' | 'disabled',
): Promise<void> {
  const { error } = await supabase.rpc('set_member_status', {
    p_org: orgId,
    p_user: userId,
    p_status: status,
  });
  if (error) {
    throw AppError.from(error);
  }
}

/** Removes someone (not the owner or yourself) and revokes what was shared with them there. */
export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_org: orgId, p_user: userId });
  if (error) {
    throw AppError.from(error);
  }
}
