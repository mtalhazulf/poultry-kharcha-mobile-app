import { sumBalance } from '../src/components/wallet/walletLogic';
import type { WalletEntry } from '../src/types/models';

let seq = 0;
function entry(amount: number): WalletEntry {
  seq += 1;
  return {
    id: `w${seq}`,
    org_id: 'org-1',
    user_id: 'user-ali',
    amount,
    note: null,
    kharcha_id: null,
    created_by: 'user-ali',
    entry_date: '2026-09-12',
    created_at: '2026-09-12T09:00:00.000Z',
  };
}

describe('sumBalance', () => {
  it('is zero for no entries', () => {
    expect(sumBalance([])).toBe(0);
  });

  it('sums top-ups and expense deductions', () => {
    expect(sumBalance([entry(5000), entry(-1800), entry(-800)])).toBe(2400);
  });

  it('sums in cents to avoid float drift', () => {
    expect(sumBalance([entry(0.1), entry(0.2)])).toBe(0.3);
  });

  it('can go negative (spent more than topped up)', () => {
    expect(sumBalance([entry(500), entry(-800)])).toBe(-300);
  });
});
