/**
 * Organizations the signed-in person belongs to, and invite codes. Tables
 * are read-only for clients and scoped by RLS; every write is an RPC from
 * supabase/migrations/20260911120000_organizations.sql.
 */
import { AppError } from '../lib/errors';
import { requireUserId, supabase } from '../lib/supabase';
import type { Json } from '../types/database';
import {
  isMemberStatus,
  isOrgRole,
  toOrganization,
  type MemberStatus,
  type Membership,
  type Organization,
} from '../types/models';

/** 32 characters without look-alikes (no I, O, 0 or 1). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Uppercase, then drop everything that is not A–Z or 0–9 (`"abcd-efgh "` → `"ABCDEFGH"`). */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Display form `XXXX-XXXX`. Partial input is formatted as typed (`"abcde"` → `"ABCD-E"`). */
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  return normalized.length > 4 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
}

/** True when the input (in any form) is a well-formed code. It may still be unknown. */
export function isValidInviteCode(input: string): boolean {
  return INVITE_CODE_RE.test(normalizeInviteCode(input));
}

/** An error sentence, or null when the name is acceptable (2–80 characters after trimming). */
export function validateOrganizationName(name: string): string | null {
  const length = Array.from(name.trim()).length;
  if (length < 2) {
    return 'Enter a name with at least 2 characters.';
  }
  if (length > 80) {
    return 'Keep the name to 80 characters or fewer.';
  }
  return null;
}

export interface JoinRequestResult {
  orgId: string;
  orgName: string;
  status: MemberStatus;
}

const MEMBERSHIP_COLUMNS =
  'org_id, user_id, role, status, requested_at, approved_at, organization:organizations!organization_members_org_id_fkey(id, name, currency, created_at)';

/** By organization name (case-insensitive), then id, so the order is stable. */
export function compareMemberships(a: Membership, b: Membership): number {
  const an = a.organization.name.toLowerCase();
  const bn = b.organization.name.toLowerCase();
  if (an !== bn) {
    return an < bn ? -1 : 1;
  }
  return a.org_id < b.org_id ? -1 : a.org_id > b.org_id ? 1 : 0;
}

/** Every membership of the signed-in person (active, pending and disabled). */
export async function listMyMemberships(): Promise<Membership[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('organization_members')
    .select(MEMBERSHIP_COLUMNS)
    .eq('user_id', userId);
  if (error) {
    throw AppError.from(error);
  }
  const memberships: Membership[] = [];
  for (const row of data) {
    if (row.organization && isOrgRole(row.role) && isMemberStatus(row.status)) {
      memberships.push({
        org_id: row.org_id,
        user_id: row.user_id,
        role: row.role,
        status: row.status,
        requested_at: row.requested_at,
        approved_at: row.approved_at,
        organization: toOrganization(row.organization),
      });
    }
  }
  return memberships.sort(compareMemberships);
}

/** Creates an organization; the caller becomes its owner and default expense types are seeded. */
export async function createOrganization(name: string): Promise<Organization> {
  const problem = validateOrganizationName(name);
  if (problem) {
    throw new AppError('validation', problem);
  }
  const { data, error } = await supabase.rpc('create_organization', { p_name: name.trim() });
  if (error) {
    throw AppError.from(error);
  }
  return toOrganization(data);
}

export function parseJoinRequestResult(data: Json): JoinRequestResult {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const { org_id: orgId, org_name: orgName, status } = data;
    if (
      typeof orgId === 'string' &&
      typeof orgName === 'string' &&
      typeof status === 'string' &&
      isMemberStatus(status)
    ) {
      return { orgId, orgName, status };
    }
  }
  throw new AppError('unknown', 'Unexpected response from the server. Please try again.');
}

/**
 * Asks to join the organization behind an invite code. A new request is
 * `pending`; an existing membership returns its status. Errors: unknown code
 * → `not_found` "Invite code not found"; disabled access → `permission`.
 */
export async function requestToJoin(code: string): Promise<JoinRequestResult> {
  const normalized = normalizeInviteCode(code);
  if (!INVITE_CODE_RE.test(normalized)) {
    throw new AppError('validation', 'Enter the 8-character invite code.');
  }
  const { data, error } = await supabase.rpc('request_to_join', { p_code: normalized });
  if (error) {
    throw AppError.from(error);
  }
  return parseJoinRequestResult(data);
}

/** Leaves an organization, or cancels a pending request. The owner cannot leave. */
export async function leaveOrganization(orgId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_organization', { p_org: orgId });
  if (error) {
    throw AppError.from(error);
  }
}

export async function renameOrganization(orgId: string, name: string): Promise<void> {
  const problem = validateOrganizationName(name);
  if (problem) {
    throw new AppError('validation', problem);
  }
  const { error } = await supabase.rpc('rename_organization', {
    p_org: orgId,
    p_name: name.trim(),
  });
  if (error) {
    throw AppError.from(error);
  }
}

/** Admins only; `currency` must be one of `CURRENCY_OPTIONS` (a 3-letter code). */
export async function setOrganizationCurrency(orgId: string, currency: string): Promise<void> {
  const { error } = await supabase.rpc('set_organization_currency', {
    p_org: orgId,
    p_currency: currency,
  });
  if (error) {
    throw AppError.from(error);
  }
}

/** The raw 8-character code (use `formatInviteCode` to display). Owners/admins only. */
export async function getInviteCode(orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('organization_invite_codes')
    .select('code')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) {
    throw AppError.from(error);
  }
  if (!data) {
    throw new AppError('permission', 'Only an owner or admin can see the invite code.');
  }
  return data.code;
}

/** Replaces the code; the old one stops working immediately. Returns the new raw code. */
export async function regenerateInviteCode(orgId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { p_org: orgId });
  if (error) {
    throw AppError.from(error);
  }
  return data;
}

/** Owner only. The target must be an active member; the caller becomes an admin. */
export async function transferOwnership(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_ownership', { p_org: orgId, p_user: userId });
  if (error) {
    throw AppError.from(error);
  }
}
