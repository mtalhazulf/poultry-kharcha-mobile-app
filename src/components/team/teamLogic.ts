/**
 * Pure rules for the Team tab and member detail: labels, relative times,
 * search, and which admin actions to offer. The action rules mirror the RPC
 * checks in supabase/migrations/20260911120000_organizations.sql; the
 * database stays the real gate, the UI only hides what would be refused.
 */
import { formatInviteCode, normalizeInviteCode } from '../../api/organizations';
import { formatDate, parseTimestamp, toIsoDate } from '../../theme';
import type { MemberStatus, OrgMember, OrgRole, ProfileSummary } from '../../types/models';
import type { BadgeTone } from '../../ui';

/** Show the search field above the member list from this many people. */
export const MEMBER_SEARCH_THRESHOLD = 8;

const ROLE_LABELS: Record<OrgRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const ROLE_TONES: Record<OrgRole, BadgeTone> = { owner: 'primary', admin: 'info', member: 'neutral' };

export function roleLabel(role: OrgRole): string {
  return ROLE_LABELS[role];
}

export function roleTone(role: OrgRole): BadgeTone {
  return ROLE_TONES[role];
}

/** Display name, else email, else a placeholder (same rule as api/members). */
export function personName(profile: Pick<ProfileSummary, 'display_name' | 'email'>): string {
  return profile.display_name?.trim() || profile.email || 'Unknown member';
}

// Shared with the expense list, which parses `created_at` the same way.
export { parseTimestamp };

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Phrase that reads after a verb: "just now", "5 minutes ago", "3 hours ago",
 * "yesterday", "4 days ago", then "on 2 Sep 2026". Empty for bad input.
 */
export function relativeTimePhrase(value: string, now: Date = new Date()): string {
  const date = parseTimestamp(value);
  if (!date) {
    return '';
  }
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 1) {
    return 'yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  return `on ${formatDate(toIsoDate(date))}`;
}

/** "Joined 10 Sep 2026", or "Requested 10 Sep 2026" while pending. Empty when unknown. */
export function memberDateLine(
  member: Pick<OrgMember, 'status' | 'requested_at' | 'approved_at'>,
): string {
  const pending = member.status === 'pending';
  const date = parseTimestamp(pending ? member.requested_at : member.approved_at ?? member.requested_at);
  if (!date) {
    return '';
  }
  return `${pending ? 'Requested' : 'Joined'} ${formatDate(toIsoDate(date))}`;
}

export interface MemberPermissions {
  /** Approve or decline a pending request. */
  canReview: boolean;
  canChangeRole: boolean;
  canChangeStatus: boolean;
  canRemove: boolean;
  canTransfer: boolean;
}

export interface Viewer {
  userId: string | null;
  role: OrgRole | null;
}

/**
 * What `viewer` may do to `target`. Nothing on yourself, nothing on the
 * owner; role, access and removal only once a request is approved; ownership
 * only from the owner to an active member.
 */
export function memberPermissions(
  viewer: Viewer,
  target: { user_id: string; role: OrgRole; status: MemberStatus },
): MemberPermissions {
  const isAdmin = viewer.role === 'owner' || viewer.role === 'admin';
  const isSelf = viewer.userId !== null && viewer.userId === target.user_id;
  const pending = target.status === 'pending';
  const manageable = isAdmin && !isSelf && target.role !== 'owner';
  return {
    canReview: manageable && pending,
    canChangeRole: manageable && !pending,
    canChangeStatus: manageable && !pending,
    canRemove: manageable && !pending,
    canTransfer: viewer.role === 'owner' && !isSelf && target.status === 'active',
  };
}

/** Pending requests (newest first) apart from everyone else (order kept). */
export function splitMembers(members: ReadonlyArray<OrgMember>): {
  requests: OrgMember[];
  people: OrgMember[];
} {
  const requests: OrgMember[] = [];
  const people: OrgMember[] = [];
  for (const member of members) {
    (member.status === 'pending' ? requests : people).push(member);
  }
  requests.sort((a, b) => (a.requested_at < b.requested_at ? 1 : a.requested_at > b.requested_at ? -1 : 0));
  return { requests, people };
}

/** Case-insensitive match on name or email; everyone for a blank query. */
export function filterMembers(members: ReadonlyArray<OrgMember>, query: string): OrgMember[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...members];
  }
  return members.filter(
    member =>
      personName(member.profile).toLowerCase().includes(q) ||
      member.profile.email.toLowerCase().includes(q),
  );
}

export function inviteShareMessage(orgName: string, code: string): string {
  return `Join ${orgName} on MPS Expense Tracker. Invite code: ${formatInviteCode(code)}`;
}

/** "A B C D, E F G H" so screen readers spell the code instead of reading a word. */
export function spokenInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  const halves = [normalized.slice(0, 4), normalized.slice(4)].filter(Boolean);
  return halves.map(half => half.split('').join(' ')).join(', ');
}
