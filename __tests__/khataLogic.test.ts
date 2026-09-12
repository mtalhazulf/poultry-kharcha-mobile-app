import { entriesForPerson, personBalances } from '../src/components/khata/khataLogic';
import type { KhataEntry, OrgMember } from '../src/types/models';

const ALI = 'user-ali';
const SARA = 'user-sara';

function member(userId: string, name: string, email: string, status: OrgMember['status'] = 'active'): OrgMember {
  return {
    org_id: 'org-1',
    user_id: userId,
    role: 'member',
    status,
    requested_at: '2026-09-01T00:00:00.000Z',
    approved_at: '2026-09-01T00:00:00.000Z',
    profile: { id: userId, email, display_name: name, avatar_url: null },
  };
}

let seq = 0;
function entry(overrides: Partial<KhataEntry> = {}): KhataEntry {
  seq += 1;
  return {
    id: `k${seq}`,
    org_id: 'org-1',
    user_id: ALI,
    amount: 1000,
    note: null,
    entry_date: '2026-09-12',
    created_at: '2026-09-12T09:00:00.000Z',
    updated_at: '2026-09-12T09:00:00.000Z',
    person: null,
    ...overrides,
  };
}

describe('personBalances', () => {
  it('sums entries per person and includes members with no entries at zero', () => {
    const members = [member(ALI, 'Ali Khan', 'ali@example.com'), member(SARA, 'Sara', 'sara@example.com')];
    const entries = [entry({ user_id: ALI, amount: 5000 }), entry({ user_id: ALI, amount: -2000 })];
    const balances = personBalances(entries, members);
    expect(balances).toEqual([
      { userId: ALI, name: 'Ali Khan', email: 'ali@example.com', avatarUrl: null, balance: 3000 },
      { userId: SARA, name: 'Sara', email: 'sara@example.com', avatarUrl: null, balance: 0 },
    ]);
  });

  it('sorts by balance descending, then name', () => {
    const members = [
      member(ALI, 'Zed', 'zed@example.com'),
      member(SARA, 'Ann', 'ann@example.com'),
      member('user-c', 'Bea', 'bea@example.com'),
    ];
    const entries = [entry({ user_id: ALI, amount: 100 }), entry({ user_id: SARA, amount: 100 })];
    const balances = personBalances(entries, members);
    // Ali and Sara tie at 100 -> alphabetical (Ann before Zed); Bea (0) last.
    expect(balances.map(b => b.userId)).toEqual([SARA, ALI, 'user-c']);
  });

  it('excludes non-active members', () => {
    const members = [member(ALI, 'Ali', 'ali@example.com', 'disabled')];
    expect(personBalances([], members)).toEqual([]);
  });

  it('sums in cents to avoid float drift', () => {
    const members = [member(ALI, 'Ali', 'ali@example.com')];
    const entries = [entry({ amount: 0.1 }), entry({ amount: 0.2 })];
    expect(personBalances(entries, members)[0]?.balance).toBe(0.3);
  });
});

describe('entriesForPerson', () => {
  it('filters to one person and sorts newest first', () => {
    const older = entry({ user_id: ALI, entry_date: '2026-09-01' });
    const newer = entry({ user_id: ALI, entry_date: '2026-09-10' });
    const other = entry({ user_id: SARA, entry_date: '2026-09-15' });
    expect(entriesForPerson([older, newer, other], ALI).map(e => e.id)).toEqual([newer.id, older.id]);
  });

  it('breaks ties on the same date by newest created', () => {
    const first = entry({ user_id: ALI, entry_date: '2026-09-12', created_at: '2026-09-12T08:00:00.000Z' });
    const second = entry({ user_id: ALI, entry_date: '2026-09-12', created_at: '2026-09-12T09:00:00.000Z' });
    expect(entriesForPerson([first, second], ALI).map(e => e.id)).toEqual([second.id, first.id]);
  });
});
