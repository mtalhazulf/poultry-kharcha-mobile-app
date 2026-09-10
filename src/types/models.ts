/**
 * Application-level models. These mirror the Postgres schema in
 * supabase/migrations exactly; the only narrowing is on enum-like text
 * columns the database constrains with a CHECK.
 */
import type { Tables } from './database';

export type Visibility = 'private' | 'shared';
export type Role = 'admin' | 'member';

export interface Profile {
  id: string;
  email: string;
  /** Generated column: lower(email). */
  email_lower: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  /** Set by an admin; a disabled account can sign in but sees no data (RLS). */
  disabled: boolean;
  created_at: string;
}

export interface Kharcha {
  id: string;
  owner_id: string;
  /** numeric(12,2) — always a number on the wire, two decimals max. */
  amount: number;
  category: string;
  /** Emoji frozen on the row at save time (category names can change later). */
  category_icon: string | null;
  note: string | null;
  /** ISO date (YYYY-MM-DD), no time component. */
  expense_date: string;
  /** Storage key inside the private `receipts` bucket: `{kharcha_id}/{filename}`. */
  receipt_path: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface KharchaShare {
  kharcha_id: string;
  shared_with: string;
  shared_by: string;
  created_at: string;
}

/** A share joined with the recipient's profile, as shown in the share modal. */
export interface KharchaShareWithProfile extends KharchaShare {
  profile: Profile;
}

/** Org-wide expense type, managed by admins in Settings. */
export interface Category {
  id: string;
  name: string;
  emoji: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

/** Staff invitation; sign-up is rejected for any email not listed here. */
export interface Invite {
  email: string;
  role: Role;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

/** Fields the user supplies when creating/editing an expense. */
export interface KharchaInput {
  amount: number;
  category: string;
  category_icon?: string | null;
  note: string | null;
  expense_date: string;
  visibility?: Visibility;
}

/**
 * Poultry-farm defaults. The database seeds the same list; this copy is the
 * offline / first-render fallback and the source of icons for old rows.
 */
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: 'Feed', emoji: '🌾' },
  { name: 'Chicks', emoji: '🐣' },
  { name: 'Medicine', emoji: '💊' },
  { name: 'Vaccine', emoji: '💉' },
  { name: 'Labour', emoji: '👷' },
  { name: 'Electricity', emoji: '💡' },
  { name: 'Water', emoji: '💧' },
  { name: 'Transport', emoji: '🚚' },
  { name: 'Equipment', emoji: '🔧' },
  { name: 'Repair', emoji: '🛠️' },
  { name: 'Bedding', emoji: '🌿' },
  { name: 'Rent', emoji: '🏠' },
  { name: 'Other', emoji: '📦' },
];

export const CATEGORIES: readonly string[] = DEFAULT_CATEGORIES.map(c => c.name);

export const VISIBILITIES: readonly Visibility[] = ['private', 'shared'];
export const ROLES: readonly Role[] = ['admin', 'member'];

export function isVisibility(value: string): value is Visibility {
  return value === 'private' || value === 'shared';
}

export function isRole(value: string): value is Role {
  return value === 'admin' || value === 'member';
}

/** Narrow a raw `kharcha` row from PostgREST into the app model. */
export function toKharcha(row: Tables<'kharcha'>): Kharcha {
  return {
    ...row,
    amount: typeof row.amount === 'string' ? Number(row.amount) : row.amount,
    visibility: isVisibility(row.visibility) ? row.visibility : 'private',
  };
}

export function toProfile(row: Tables<'profiles'>): Profile {
  return { ...row, role: isRole(row.role) ? row.role : 'member' };
}

export function toCategory(row: Tables<'categories'>): Category {
  return { ...row };
}

export function toInvite(row: Tables<'invites'>): Invite {
  return { ...row, role: isRole(row.role) ? row.role : 'member' };
}
