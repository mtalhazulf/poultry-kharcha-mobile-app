import {
  filterMembers,
  inviteShareMessage,
  memberDateLine,
  memberPermissions,
  parseTimestamp,
  personName,
  relativeTimePhrase,
  roleLabel,
  roleTone,
  splitMembers,
  spokenInviteCode,
} from '../src/components/team/teamLogic';
import type { OrgMember } from '../src/types/models';

jest.mock('../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
  requireUserId: jest.fn(async () => '00000000-0000-4000-8000-000000000001'),
}));

function member(overrides: Partial<OrgMember> & { user_id: string }): OrgMember {
  return {
    org_id: 'org-1',
    role: 'member',
    status: 'active',
    requested_at: '2026-09-01T09:00:00.000+00:00',
    approved_at: null,
    profile: { id: overrides.user_id, email: `${overrides.user_id}@example.com`, display_name: null, avatar_url: null },
    ...overrides,
  };
}

describe('roles', () => {
  it('labels and colors roles', () => {
    expect(roleLabel('owner')).toBe('Owner');
    expect(roleTone('owner')).toBe('primary');
    expect(roleTone('admin')).toBe('info');
    expect(roleTone('member')).toBe('neutral');
  });

  it('names people by display name, then email', () => {
    expect(personName({ display_name: '  Sara Ahmed ', email: 'sara@example.com' })).toBe('Sara Ahmed');
    expect(personName({ display_name: '  ', email: 'sara@example.com' })).toBe('sara@example.com');
    expect(personName({ display_name: null, email: '' })).toBe('Unknown member');
  });
});

describe('timestamps', () => {
  it('parses Postgres timestamps with microseconds', () => {
    expect(parseTimestamp('2026-09-11T20:30:12.123456+00:00')?.getTime()).toBe(
      Date.UTC(2026, 8, 11, 20, 30, 12, 123),
    );
    expect(parseTimestamp('not a date')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
  });

  it('describes how long ago something happened', () => {
    const now = new Date(2026, 8, 12, 12, 0, 0);
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(relativeTimePhrase(ago(30_000), now)).toBe('just now');
    expect(relativeTimePhrase(ago(-120_000), now)).toBe('just now');
    expect(relativeTimePhrase(ago(60_000), now)).toBe('1 minute ago');
    expect(relativeTimePhrase(ago(45 * 60_000), now)).toBe('45 minutes ago');
    expect(relativeTimePhrase(ago(60 * 60_000), now)).toBe('1 hour ago');
    expect(relativeTimePhrase(ago(5 * 60 * 60_000), now)).toBe('5 hours ago');
    expect(relativeTimePhrase(new Date(2026, 8, 11, 9, 0).toISOString(), now)).toBe('yesterday');
    expect(relativeTimePhrase(new Date(2026, 8, 9, 12, 0).toISOString(), now)).toBe('3 days ago');
    expect(relativeTimePhrase(new Date(2026, 8, 1, 12, 0).toISOString(), now)).toBe('on 1 Sep 2026');
    expect(relativeTimePhrase('garbage', now)).toBe('');
  });

  it('shows when someone joined or asked to join', () => {
    const noon = (day: number) => new Date(2026, 8, day, 12, 0).toISOString();
    expect(memberDateLine({ status: 'active', requested_at: noon(1), approved_at: noon(3) })).toBe('Joined 3 Sep 2026');
    expect(memberDateLine({ status: 'disabled', requested_at: noon(1), approved_at: null })).toBe('Joined 1 Sep 2026');
    expect(memberDateLine({ status: 'pending', requested_at: noon(10), approved_at: null })).toBe(
      'Requested 10 Sep 2026',
    );
  });
});

describe('memberPermissions', () => {
  const admin = { userId: 'admin', role: 'admin' as const };
  const owner = { userId: 'owner', role: 'owner' as const };
  const none = { canReview: false, canChangeRole: false, canChangeStatus: false, canRemove: false, canTransfer: false };

  it('lets admins manage approved members but not transfer ownership', () => {
    expect(memberPermissions(admin, member({ user_id: 'm1' }))).toEqual({
      canReview: false,
      canChangeRole: true,
      canChangeStatus: true,
      canRemove: true,
      canTransfer: false,
    });
  });

  it('never offers actions on yourself or on the owner', () => {
    expect(memberPermissions(admin, member({ user_id: 'admin', role: 'admin' }))).toEqual(none);
    expect(memberPermissions(admin, member({ user_id: 'owner', role: 'owner' }))).toEqual(none);
    expect(memberPermissions(owner, member({ user_id: 'owner', role: 'owner' }))).toEqual(none);
  });

  it('only offers review on pending requests', () => {
    expect(memberPermissions(admin, member({ user_id: 'p1', status: 'pending' }))).toEqual({ ...none, canReview: true });
    expect(memberPermissions(owner, member({ user_id: 'p1', status: 'pending' }))).toEqual({ ...none, canReview: true });
  });

  it('lets the owner transfer ownership to active members only', () => {
    expect(memberPermissions(owner, member({ user_id: 'a1', role: 'admin' })).canTransfer).toBe(true);
    expect(memberPermissions(owner, member({ user_id: 'd1', status: 'disabled' }))).toEqual({
      canReview: false,
      canChangeRole: true,
      canChangeStatus: true,
      canRemove: true,
      canTransfer: false,
    });
  });

  it('offers nothing to members or when the role is unknown', () => {
    expect(memberPermissions({ userId: 'm2', role: 'member' }, member({ user_id: 'm1' }))).toEqual(none);
    expect(memberPermissions({ userId: null, role: null }, member({ user_id: 'm1' }))).toEqual(none);
  });
});

describe('member lists', () => {
  const people = [
    member({ user_id: 'owner', role: 'owner', profile: { id: 'owner', email: 'talha@obscode.io', display_name: 'Talha', avatar_url: null } }),
    member({ user_id: 'p-old', status: 'pending', requested_at: '2026-09-01T08:00:00.000+00:00' }),
    member({ user_id: 'sara', profile: { id: 'sara', email: 'sara@farm.pk', display_name: 'Sara Ahmed', avatar_url: null } }),
    member({ user_id: 'p-new', status: 'pending', requested_at: '2026-09-11T08:00:00.000+00:00' }),
  ];

  it('separates requests (newest first) from people', () => {
    const { requests, people: rest } = splitMembers(people);
    expect(requests.map(m => m.user_id)).toEqual(['p-new', 'p-old']);
    expect(rest.map(m => m.user_id)).toEqual(['owner', 'sara']);
  });

  it('searches names and emails without case', () => {
    expect(filterMembers(people, 'SARA').map(m => m.user_id)).toEqual(['sara']);
    expect(filterMembers(people, 'obscode').map(m => m.user_id)).toEqual(['owner']);
    expect(filterMembers(people, '   ')).toHaveLength(4);
    expect(filterMembers(people, 'nobody')).toEqual([]);
  });
});

describe('invite code copy', () => {
  it('builds the share message with the formatted code', () => {
    expect(inviteShareMessage('MPS', 'abcdefgh')).toBe('Join MPS on MPS Expense Tracker. Invite code: ABCD-EFGH');
  });

  it('spells the code for screen readers', () => {
    expect(spokenInviteCode('ABCD-EFGH')).toBe('A B C D, E F G H');
  });
});
