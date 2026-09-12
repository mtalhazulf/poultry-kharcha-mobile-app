import {
  DEFAULT_CATEGORIES,
  isAdminRole,
  isIconKey,
  isMemberStatus,
  isOrgRole,
  toCategory,
  toKharcha,
  toOrganization,
  toProfile,
} from '../src/types/models';
import type { Tables } from '../src/types/database';

function row(overrides: Partial<Tables<'kharcha'>> = {}): Tables<'kharcha'> {
  return {
    id: '4f4e2b1c-2a5e-4a73-9b0b-4f1a3c8d9e01',
    org_id: '1a2b3c4d-2a5e-4a73-9b0b-4f1a3c8d9e03',
    owner_id: '0f0e2b1c-2a5e-4a73-9b0b-4f1a3c8d9e02',
    amount: 100,
    category: 'Feed',
    category_icon: 'wheat',
    note: null,
    expense_date: '2026-09-10',
    receipt_path: null,
    created_at: '2026-09-10T10:00:00.000Z',
    updated_at: '2026-09-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('toKharcha', () => {
  it('coerces a numeric string amount (PostgREST numeric) to a number', () => {
    const result = toKharcha(row({ amount: '12.50' as unknown as number }));
    expect(result.amount).toBe(12.5);
    expect(typeof result.amount).toBe('number');
  });

  it('copies every column, including org_id, into a new object', () => {
    const raw = row({ amount: 99.99, note: 'lunch', receipt_path: 'abc/receipt.jpg' });
    const result = toKharcha(raw);
    expect(result).toEqual(raw);
    expect(result).not.toBe(raw);
    expect(result.org_id).toBe(raw.org_id);
  });

  it('does not carry embedded relations onto the model', () => {
    const raw = { ...row(), owner: { id: 'x' } } as Tables<'kharcha'>;
    expect(toKharcha(raw)).not.toHaveProperty('owner');
  });
});

describe('enum guards', () => {
  it('isOrgRole accepts owner, admin and member', () => {
    expect(['owner', 'admin', 'member'].every(isOrgRole)).toBe(true);
    expect(isOrgRole('Admin')).toBe(false);
    expect(isOrgRole('superadmin')).toBe(false);
  });

  it('isMemberStatus accepts active, pending and disabled', () => {
    expect(['active', 'pending', 'disabled'].every(isMemberStatus)).toBe(true);
    expect(isMemberStatus('removed')).toBe(false);
  });

  it('isAdminRole is true for owners and admins only', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('member')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe('isIconKey', () => {
  it('accepts lucide kebab-case keys', () => {
    for (const key of ['package', 'hard-hat', 'shopping-cart', 'wifi']) {
      expect(isIconKey(key)).toBe(true);
    }
  });

  it('rejects emoji, capitals, stray dashes and overlong keys', () => {
    for (const key of [
      '🌾',
      'Package',
      'hard_hat',
      '-zap',
      'zap-',
      'hard--hat',
      '',
      'a'.repeat(41),
    ]) {
      expect(isIconKey(key)).toBe(false);
    }
  });
});

describe('row mappers', () => {
  it('toProfile keeps the contract fields only', () => {
    const raw: Tables<'profiles'> = {
      id: '0f0e2b1c-2a5e-4a73-9b0b-4f1a3c8d9e02',
      email: 'Test@Example.com',
      email_lower: 'test@example.com',
      display_name: null,
      avatar_url: null,
      created_at: '2026-09-10T10:00:00.000Z',
    };
    expect(toProfile(raw)).toEqual({
      id: raw.id,
      email: 'Test@Example.com',
      display_name: null,
      avatar_url: null,
      created_at: raw.created_at,
    });
  });

  it('toOrganization drops server-only columns', () => {
    const raw: Tables<'organizations'> = {
      id: 'org-1',
      name: 'MPS',
      currency: 'PKR',
      created_by: 'user-1',
      created_at: '2026-09-11T00:00:00.000Z',
      updated_at: '2026-09-11T00:00:00.000Z',
    };
    expect(toOrganization(raw)).toEqual({
      id: 'org-1',
      name: 'MPS',
      currency: 'PKR',
      created_at: raw.created_at,
    });
  });

  it('toCategory copies the row', () => {
    const raw: Tables<'categories'> = {
      id: 'cat-1',
      org_id: 'org-1',
      name: 'Feed',
      icon: 'wheat',
      sort_order: 10,
      active: true,
      created_at: '2026-09-11T00:00:00.000Z',
    };
    expect(toCategory(raw)).toEqual(raw);
    expect(toCategory(raw)).not.toBe(raw);
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('matches the list create_organization seeds, in order', () => {
    expect(DEFAULT_CATEGORIES.map(c => `${c.name}:${c.icon}`)).toEqual([
      'Feed:wheat',
      'Chicks:egg',
      'Medicine:pill',
      'Vaccine:syringe',
      'Labour:hard-hat',
      'Electricity:zap',
      'Water:droplets',
      'Transport:truck',
      'Equipment:wrench',
      'Repair:hammer',
      'Bedding:layers',
      'Rent:warehouse',
      'Other:package',
    ]);
  });

  it('has unique names ignoring case', () => {
    const lower = DEFAULT_CATEGORIES.map(c => c.name.trim().toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('uses valid icon keys and no emoji', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(isIconKey(c.icon)).toBe(true);
      expect(/\p{Extended_Pictographic}/u.test(`${c.name}${c.icon}`)).toBe(false);
    }
  });
});
