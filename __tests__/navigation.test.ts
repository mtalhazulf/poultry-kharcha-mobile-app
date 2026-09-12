import { getRootStage, type RootStageInput } from '../src/navigation/rootStage';
import { inviteCodeInputValue, inviteCodeProblem } from '../src/screens/JoinOrgScreen';

jest.mock('../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
  requireUserId: jest.fn(async () => '00000000-0000-4000-8000-000000000001'),
}));

/** Signed in, unlocked, memberships loaded, active organization, walkthrough done. */
const READY: RootStageInput = {
  initializing: false,
  signedIn: true,
  lockReady: true,
  locked: false,
  orgStarted: true,
  orgLoading: false,
  membershipCount: 1,
  hasActiveOrg: true,
  walkthroughSeen: true,
};

function stage(patch: Partial<RootStageInput>) {
  return getRootStage({ ...READY, ...patch });
}

describe('getRootStage', () => {
  it('shows the app when everything is ready', () => {
    expect(stage({})).toBe('app');
  });

  it('shows the splash while the persisted session is read', () => {
    expect(stage({ initializing: true, signedIn: false })).toBe('splash');
    expect(stage({ initializing: true })).toBe('splash');
  });

  it('shows sign-in without a session, whatever the other providers say', () => {
    expect(stage({ signedIn: false, locked: true, hasActiveOrg: false, lockReady: false })).toBe(
      'auth',
    );
  });

  it('waits for the biometric preference before showing anything protected', () => {
    expect(stage({ lockReady: false })).toBe('splash');
  });

  it('locks before any organization screen', () => {
    expect(stage({ locked: true })).toBe('lock');
    expect(stage({ locked: true, hasActiveOrg: false, membershipCount: 0 })).toBe('lock');
    expect(stage({ locked: true, orgStarted: false })).toBe('lock');
  });

  it('shows the splash until memberships are known', () => {
    expect(stage({ orgStarted: false, hasActiveOrg: false, membershipCount: 0 })).toBe('splash');
    expect(stage({ orgLoading: true, hasActiveOrg: false, membershipCount: 0 })).toBe('splash');
  });

  it('uses cached memberships while they refresh', () => {
    expect(stage({ orgLoading: true, membershipCount: 2 })).toBe('app');
    expect(stage({ orgLoading: true, membershipCount: 1, hasActiveOrg: false })).toBe('org');
  });

  it('shows organization setup without an active organization', () => {
    expect(stage({ hasActiveOrg: false, membershipCount: 0 })).toBe('org');
    // Only pending requests.
    expect(stage({ hasActiveOrg: false, membershipCount: 2 })).toBe('org');
    // No need to know the walkthrough flag yet.
    expect(stage({ hasActiveOrg: false, walkthroughSeen: null })).toBe('org');
  });

  it('waits for the walkthrough flag before choosing the first app screen', () => {
    expect(stage({ walkthroughSeen: null })).toBe('splash');
    expect(stage({ walkthroughSeen: false })).toBe('app');
  });
});

describe('invite code field', () => {
  it('formats as XXXX-XXXX while typing', () => {
    expect(inviteCodeInputValue('')).toBe('');
    expect(inviteCodeInputValue('a')).toBe('A');
    expect(inviteCodeInputValue('abcd')).toBe('ABCD');
    expect(inviteCodeInputValue('abcde')).toBe('ABCD-E');
    expect(inviteCodeInputValue('abcdefgh')).toBe('ABCD-EFGH');
  });

  it('drops a trailing separator when deleting back to four characters', () => {
    expect(inviteCodeInputValue('ABCD-')).toBe('ABCD');
  });

  it('cleans pasted codes and stops at eight characters', () => {
    expect(inviteCodeInputValue(' abcd efgh ')).toBe('ABCD-EFGH');
    expect(inviteCodeInputValue('ABCD-EFGH-JK')).toBe('ABCD-EFGH');
    expect(inviteCodeInputValue('ab.cd/ef_gh')).toBe('ABCD-EFGH');
    expect(inviteCodeInputValue('ABCD-EFGH').length).toBeLessThanOrEqual(9);
  });

  it('explains incomplete and impossible codes before sending', () => {
    expect(inviteCodeProblem('')).toBe('Enter the 8-character invite code.');
    expect(inviteCodeProblem('ABCD-EFG')).toBe('Enter the 8-character invite code.');
    expect(inviteCodeProblem('ABCD-EFG0')).toMatch(/do not use I, O, 0 or 1/);
    expect(inviteCodeProblem('abcd-efgh')).toBeNull();
    expect(inviteCodeProblem('K7PX-3MQ9')).toBeNull();
  });
});
