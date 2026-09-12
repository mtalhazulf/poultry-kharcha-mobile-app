/**
 * Application models (docs/ARCHITECTURE.md §3). They mirror the Postgres
 * schema in supabase/migrations; text columns the database constrains with a
 * CHECK are narrowed to unions here.
 */
import type { Tables } from './database';

export type OrgRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'pending' | 'disabled';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type ProfileSummary = Pick<Profile, 'id' | 'email' | 'display_name' | 'avatar_url'>;

export interface Organization {
  id: string;
  name: string;
  /** ISO 4217 code, e.g. `PKR`. */
  currency: string;
  created_at: string;
}

/** One of the signed-in person's memberships. */
export interface Membership {
  org_id: string;
  user_id: string;
  role: OrgRole;
  status: MemberStatus;
  requested_at: string;
  approved_at: string | null;
  organization: Organization;
}

/** A person in an organization, as listed on the Team screen. */
export interface OrgMember {
  org_id: string;
  user_id: string;
  role: OrgRole;
  status: MemberStatus;
  requested_at: string;
  approved_at: string | null;
  /** `{ id: user_id, email: '', display_name: null, avatar_url: null }` if the profile is not readable. */
  profile: ProfileSummary;
}

export interface Kharcha {
  id: string;
  org_id: string;
  owner_id: string;
  /** numeric(12,2) — always a number in the app, two decimals max. */
  amount: number;
  category: string;
  /** Icon key (lucide, kebab-case) frozen on the row when it was saved. */
  category_icon: string | null;
  note: string | null;
  /** ISO date (YYYY-MM-DD), no time component. */
  expense_date: string;
  /** Storage key inside the private `receipts` bucket: `{kharcha_id}/{filename}`. */
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface KharchaWithOwner extends Kharcha {
  /** Null when the owner's profile is not readable (e.g. they left the organization). */
  owner: ProfileSummary | null;
}

/** A prior state of an expense, archived whenever an edit changes one of its fields. */
export interface KharchaHistoryEntry {
  id: string;
  kharcha_id: string;
  /** 1, 2, 3... in the order the edits happened. */
  version: number;
  amount: number;
  category: string;
  category_icon: string | null;
  note: string | null;
  expense_date: string;
  receipt_path: string | null;
  edited_by: string;
  edited_at: string;
  /** Null when the editor's profile is not readable (e.g. they left the organization). */
  editor: ProfileSummary | null;
}

/** An expense type of one organization, managed by its owner/admins. */
export interface Category {
  id: string;
  org_id: string;
  name: string;
  /** Icon key (lucide, kebab-case). */
  icon: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

/** Fields the user supplies when creating/editing an expense. */
export interface KharchaInput {
  amount: number;
  category: string;
  categoryIcon: string | null;
  note: string | null;
  /** YYYY-MM-DD */
  expenseDate: string;
  receiptPath?: string | null;
}

export interface ReportSummary {
  total: number;
  count: number;
  /** Total of the equally long period that ends the day before `from`. */
  previousTotal: number;
  /** Sorted by total, largest first. */
  byCategory: { category: string; icon: string | null; total: number; count: number }[];
  /** Sorted by total, largest first. */
  byMember: { userId: string; name: string; email: string; total: number; count: number }[];
  /** Only days that have expenses, ascending. `fillDailyTotals` (api/reports) adds the gaps. */
  byDay: { date: string; total: number }[];
}

/**
 * Poultry-farm defaults. `create_organization` seeds exactly these (same
 * names, icons and order) for every new organization.
 */
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; icon: string }> = [
  { name: 'Feed', icon: 'wheat' },
  { name: 'Chicks', icon: 'egg' },
  { name: 'Medicine', icon: 'pill' },
  { name: 'Vaccine', icon: 'syringe' },
  { name: 'Labour', icon: 'hard-hat' },
  { name: 'Electricity', icon: 'zap' },
  { name: 'Water', icon: 'droplets' },
  { name: 'Transport', icon: 'truck' },
  { name: 'Equipment', icon: 'wrench' },
  { name: 'Repair', icon: 'hammer' },
  { name: 'Bedding', icon: 'layers' },
  { name: 'Rent', icon: 'warehouse' },
  { name: 'Other', icon: 'package' },
];

export const ORG_ROLES: readonly OrgRole[] = ['owner', 'admin', 'member'];
export const MEMBER_STATUSES: readonly MemberStatus[] = ['active', 'pending', 'disabled'];

export function isOrgRole(value: string): value is OrgRole {
  return value === 'owner' || value === 'admin' || value === 'member';
}

export function isMemberStatus(value: string): value is MemberStatus {
  return value === 'active' || value === 'pending' || value === 'disabled';
}

/** Owners and admins manage expense types, the invite code and members. */
export function isAdminRole(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

const ICON_KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Same rule as the database checks on `categories.icon` and `kharcha.category_icon`. */
export function isIconKey(value: string): boolean {
  return value.length <= 40 && ICON_KEY_RE.test(value);
}

/** Narrow a raw `kharcha` row into the app model (embedded relations are not copied). */
export function toKharcha(row: Tables<'kharcha'>): Kharcha {
  return {
    id: row.id,
    org_id: row.org_id,
    owner_id: row.owner_id,
    // numeric(12,2) can arrive as a string depending on the client config.
    amount: Number(row.amount),
    category: row.category,
    category_icon: row.category_icon,
    note: row.note,
    expense_date: row.expense_date,
    receipt_path: row.receipt_path,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Narrow a raw `kharcha_history` row into the app model (the editor relation is not copied). */
export function toKharchaHistoryEntry(row: Tables<'kharcha_history'>): KharchaHistoryEntry {
  return {
    id: row.id,
    kharcha_id: row.kharcha_id,
    version: row.version,
    amount: Number(row.amount),
    category: row.category,
    category_icon: row.category_icon,
    note: row.note,
    expense_date: row.expense_date,
    receipt_path: row.receipt_path,
    edited_by: row.edited_by,
    edited_at: row.edited_at,
    editor: null,
  };
}

export function toProfile(
  row: Pick<Tables<'profiles'>, 'id' | 'email' | 'display_name' | 'avatar_url' | 'created_at'>,
): Profile {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
  };
}

export function toProfileSummary(row: ProfileSummary): ProfileSummary {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
  };
}

export function toOrganization(
  row: Pick<Tables<'organizations'>, 'id' | 'name' | 'currency' | 'created_at'>,
): Organization {
  return { id: row.id, name: row.name, currency: row.currency, created_at: row.created_at };
}

export function toCategory(row: Tables<'categories'>): Category {
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    icon: row.icon,
    sort_order: row.sort_order,
    active: row.active,
    created_at: row.created_at,
  };
}
