/**
 * Application-level models. These mirror the Postgres schema in
 * supabase/migrations exactly; the only narrowing is `visibility`, which the
 * database constrains with a CHECK and we expose as a union type.
 */
import type { Tables } from './database';

export type Visibility = 'private' | 'shared';

export interface Profile {
  id: string;
  email: string;
  /** Generated column: lower(email). Used for share-by-email search. */
  email_lower: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Kharcha {
  id: string;
  owner_id: string;
  /** numeric(12,2) — always a number on the wire, two decimals max. */
  amount: number;
  category: string;
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

/** Fields the user supplies when creating/editing an expense. */
export interface KharchaInput {
  amount: number;
  category: string;
  note: string | null;
  expense_date: string;
  visibility?: Visibility;
}

export const CATEGORIES = [
  'Food',
  'Transport',
  'Groceries',
  'Bills',
  'Health',
  'Shopping',
  'Entertainment',
  'Education',
  'Rent',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const VISIBILITIES: readonly Visibility[] = ['private', 'shared'];

export function isVisibility(value: string): value is Visibility {
  return value === 'private' || value === 'shared';
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
  return { ...row };
}
