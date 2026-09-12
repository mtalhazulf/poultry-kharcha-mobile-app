import {
  createOrganization,
  formatInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  isValidInviteCode,
  normalizeInviteCode,
  parseJoinRequestResult,
  requestToJoin,
  validateOrganizationName,
} from '../src/api/organizations';
import { fillDailyTotals, getReportSummary, parseReportSummary } from '../src/api/reports';
import { AppError } from '../src/lib/errors';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
  requireUserId: jest.fn(async () => '00000000-0000-4000-8000-000000000001'),
}));

const rpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('normalizeInviteCode', () => {
  it('uppercases and strips the separator', () => {
    expect(normalizeInviteCode('abcd-efgh')).toBe('ABCDEFGH');
  });

  it('drops whitespace, punctuation and non-ASCII characters', () => {
    expect(normalizeInviteCode('  aBcD efgh.\n')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('ÄB·CD–EF GH')).toBe('BCDEFGH');
  });

  it('keeps digits', () => {
    expect(normalizeInviteCode('k7qm 2xpa')).toBe('K7QM2XPA');
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(normalizeInviteCode('')).toBe('');
    expect(normalizeInviteCode(' - ')).toBe('');
  });
});

describe('formatInviteCode', () => {
  it('shows eight characters as XXXX-XXXX', () => {
    expect(formatInviteCode('K7QM2XPA')).toBe('K7QM-2XPA');
    expect(formatInviteCode('k7qm 2xpa')).toBe('K7QM-2XPA');
  });

  it('is idempotent', () => {
    expect(formatInviteCode(formatInviteCode('k7qm2xpa'))).toBe('K7QM-2XPA');
  });

  it('formats partial input as it is typed', () => {
    expect(formatInviteCode('')).toBe('');
    expect(formatInviteCode('k7')).toBe('K7');
    expect(formatInviteCode('k7qm')).toBe('K7QM');
    expect(formatInviteCode('k7qm2')).toBe('K7QM-2');
  });
});

describe('isValidInviteCode', () => {
  it('accepts a code in display or raw form', () => {
    expect(isValidInviteCode('K7QM-2XPA')).toBe(true);
    expect(isValidInviteCode(' k7qm2xpa ')).toBe(true);
  });

  it('rejects look-alike characters the generator never uses', () => {
    expect(isValidInviteCode('K7QM-2XPI')).toBe(false);
    expect(isValidInviteCode('K7QM-2XPO')).toBe(false);
    expect(isValidInviteCode('K7QM-2XP0')).toBe(false);
    expect(isValidInviteCode('K7QM-2XP1')).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(isValidInviteCode('K7QM-2XP')).toBe(false);
    expect(isValidInviteCode('K7QM-2XPAB')).toBe(false);
  });
});

describe('INVITE_CODE_ALPHABET', () => {
  it('has 32 distinct characters, each accepted by the database check', () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(32);
    for (const ch of INVITE_CODE_ALPHABET) {
      expect(isValidInviteCode(ch.repeat(INVITE_CODE_LENGTH))).toBe(true);
    }
  });
});

describe('validateOrganizationName', () => {
  it('requires 2 to 80 characters after trimming', () => {
    expect(validateOrganizationName(' A ')).not.toBeNull();
    expect(validateOrganizationName('  AB ')).toBeNull();
    expect(validateOrganizationName('x'.repeat(80))).toBeNull();
    expect(validateOrganizationName('x'.repeat(81))).not.toBeNull();
  });
});

describe('createOrganization', () => {
  it('rejects a short name without calling the server', async () => {
    await expect(createOrganization(' M ')).rejects.toMatchObject({ kind: 'validation' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends the trimmed name and returns the organization', async () => {
    rpc.mockResolvedValue({
      data: {
        id: 'org-1',
        name: 'Green Farm',
        currency: 'PKR',
        created_by: 'user-1',
        created_at: '2026-09-12T00:00:00.000Z',
        updated_at: '2026-09-12T00:00:00.000Z',
      },
      error: null,
    });
    await expect(createOrganization('  Green Farm ')).resolves.toEqual({
      id: 'org-1',
      name: 'Green Farm',
      currency: 'PKR',
      created_at: '2026-09-12T00:00:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('create_organization', { p_name: 'Green Farm' });
  });
});

describe('requestToJoin', () => {
  it('rejects a malformed code without calling the server', async () => {
    await expect(requestToJoin('ABC')).rejects.toMatchObject({ kind: 'validation' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends the normalized code and maps the response', async () => {
    rpc.mockResolvedValue({
      data: { org_id: 'org-1', org_name: 'MPS', status: 'pending' },
      error: null,
    });
    await expect(requestToJoin('k7qm-2xpa')).resolves.toEqual({
      orgId: 'org-1',
      orgName: 'MPS',
      status: 'pending',
    });
    expect(rpc).toHaveBeenCalledWith('request_to_join', { p_code: 'K7QM2XPA' });
  });

  it('reports an unknown code as not_found with the server message', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'Invite code not found', details: '', hint: '' },
    });
    const err = await requestToJoin('K7QM-2XPA').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ kind: 'not_found', message: 'Invite code not found' });
  });

  it('reports turned-off access as permission with the server message', async () => {
    const message = 'Your access to MPS has been turned off. Ask an admin to restore it.';
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message, details: '', hint: '' } });
    await expect(requestToJoin('K7QM-2XPA')).rejects.toMatchObject({ kind: 'permission', message });
  });
});

describe('parseJoinRequestResult', () => {
  it('rejects an unexpected payload', () => {
    expect(() => parseJoinRequestResult(null)).toThrow(AppError);
    expect(() => parseJoinRequestResult({ org_id: 'o', org_name: 'n', status: 'owner' })).toThrow(
      AppError,
    );
  });
});

describe('parseReportSummary', () => {
  it('reads numbers, including numeric strings', () => {
    expect(
      parseReportSummary({
        total: '19300.00',
        count: 3,
        previousTotal: 0,
        byCategory: [
          { category: 'Other', icon: 'package', total: 18000, count: 1 },
          { category: 'Chicks', icon: null, total: '800.00', count: 1 },
        ],
        byMember: [{ userId: 'u1', name: 'Talha', email: 't@example.com', total: 18800, count: 2 }],
        byDay: [{ date: '2026-09-03', total: 800 }],
      }),
    ).toEqual({
      total: 19300,
      count: 3,
      previousTotal: 0,
      byCategory: [
        { category: 'Other', icon: 'package', total: 18000, count: 1 },
        { category: 'Chicks', icon: null, total: 800, count: 1 },
      ],
      byMember: [{ userId: 'u1', name: 'Talha', email: 't@example.com', total: 18800, count: 2 }],
      byDay: [{ date: '2026-09-03', total: 800 }],
    });
  });

  it('defaults missing lists and skips malformed rows', () => {
    expect(
      parseReportSummary({ total: 5, count: 1, byDay: [null, { date: 'nope', total: 1 }] }),
    ).toEqual({ total: 5, count: 1, previousTotal: 0, byCategory: [], byMember: [], byDay: [] });
  });

  it('rejects a payload that is not an object', () => {
    expect(() => parseReportSummary([])).toThrow(AppError);
  });
});

describe('fillDailyTotals', () => {
  it('fills missing days with zero across a month boundary', () => {
    expect(fillDailyTotals([{ date: '2026-08-31', total: 5 }], '2026-08-30', '2026-09-02')).toEqual(
      [
        { date: '2026-08-30', total: 0 },
        { date: '2026-08-31', total: 5 },
        { date: '2026-09-01', total: 0 },
        { date: '2026-09-02', total: 0 },
      ],
    );
  });

  it('includes leap days', () => {
    expect(fillDailyTotals([], '2028-02-28', '2028-03-01').map(d => d.date)).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('returns nothing for a reversed or impossible range', () => {
    expect(fillDailyTotals([], '2026-09-02', '2026-09-01')).toEqual([]);
    expect(fillDailyTotals([], '2026-02-30', '2026-03-01')).toEqual([]);
  });
});

describe('getReportSummary', () => {
  it('validates the range before calling the server', async () => {
    await expect(getReportSummary('org-1', '2026-09-10', '2026-09-01')).rejects.toMatchObject({
      kind: 'validation',
    });
    await expect(getReportSummary('org-1', '2026-9-1', '2026-09-30')).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls report_summary with the organization and range', async () => {
    rpc.mockResolvedValue({
      data: { total: 0, count: 0, previousTotal: 0, byCategory: [], byMember: [], byDay: [] },
      error: null,
    });
    await getReportSummary('org-1', '2026-09-01', '2026-09-30');
    expect(rpc).toHaveBeenCalledWith('report_summary', {
      p_org: 'org-1',
      p_from: '2026-09-01',
      p_to: '2026-09-30',
    });
  });
});
