import { CATEGORIES, isVisibility, toKharcha, toProfile } from '../src/types/models';
import type { Tables } from '../src/types/database';

function row(overrides: Partial<Tables<'kharcha'>> = {}): Tables<'kharcha'> {
  return {
    id: '4f4e2b1c-2a5e-4a73-9b0b-4f1a3c8d9e01',
    owner_id: '0f0e2b1c-2a5e-4a73-9b0b-4f1a3c8d9e02',
    amount: 100,
    category: 'Food',
    category_icon: null,
    note: null,
    expense_date: '2026-09-10',
    receipt_path: null,
    visibility: 'private',
    created_at: '2026-09-10T10:00:00.000Z',
    updated_at: '2026-09-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('toKharcha', () => {
  it('keeps a valid visibility value', () => {
    expect(toKharcha(row({ visibility: 'shared' })).visibility).toBe('shared');
    expect(toKharcha(row({ visibility: 'private' })).visibility).toBe('private');
  });

  it('narrows an unexpected visibility to private', () => {
    expect(toKharcha(row({ visibility: 'public' })).visibility).toBe('private');
    expect(toKharcha(row({ visibility: '' })).visibility).toBe('private');
  });

  it('coerces a numeric string amount (PostgREST numeric) to a number', () => {
    // numeric(12,2) can arrive as a string depending on the client config.
    const raw = row({ amount: '12.50' as unknown as number });
    const result = toKharcha(raw);
    expect(result.amount).toBe(12.5);
    expect(typeof result.amount).toBe('number');
  });

  it('leaves a numeric amount untouched and copies the other fields', () => {
    const raw = row({ amount: 99.99, note: 'lunch', receipt_path: 'abc/receipt.jpg' });
    const result = toKharcha(raw);
    expect(result.amount).toBe(99.99);
    expect(result.note).toBe('lunch');
    expect(result.receipt_path).toBe('abc/receipt.jpg');
    expect(result.id).toBe(raw.id);
    expect(result).not.toBe(raw);
  });
});

describe('isVisibility', () => {
  it('accepts only private and shared', () => {
    expect(isVisibility('private')).toBe(true);
    expect(isVisibility('shared')).toBe(true);
    expect(isVisibility('Shared')).toBe(false);
    expect(isVisibility('')).toBe(false);
  });
});

describe('toProfile', () => {
  it('returns a copy of the row', () => {
    const raw: Tables<'profiles'> = {
      id: '0f0e2b1c-2a5e-4a73-9b0b-4f1a3c8d9e02',
      email: 'Test@Example.com',
      email_lower: 'test@example.com',
      role: 'member',
      disabled: false,
      display_name: null,
      avatar_url: null,
      created_at: '2026-09-10T10:00:00.000Z',
    };
    const profile = toProfile(raw);
    expect(profile).toEqual(raw);
    expect(profile).not.toBe(raw);
  });
});

describe('CATEGORIES', () => {
  it('includes Other as the catch-all and has no duplicates', () => {
    expect(CATEGORIES).toContain('Other');
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
  });
});
