import { formatAmount, formatDate, toIsoDate } from '../src/theme';

describe('formatAmount', () => {
  it('groups thousands and always shows two decimals', () => {
    expect(formatAmount(1234567.5)).toBe('PKR 1,234,567.50');
    expect(formatAmount(1000)).toBe('PKR 1,000.00');
    expect(formatAmount(999)).toBe('PKR 999.00');
    expect(formatAmount(0)).toBe('PKR 0.00');
  });

  it('rounds to two decimals', () => {
    expect(formatAmount(12.345)).toBe('PKR 12.35');
    expect(formatAmount(0.1 + 0.2)).toBe('PKR 0.30');
  });

  it('puts the sign before the currency for negatives', () => {
    expect(formatAmount(-42)).toBe('-PKR 42.00');
    expect(formatAmount(-1234.5)).toBe('-PKR 1,234.50');
  });

  it('accepts a currency override', () => {
    expect(formatAmount(2500, 'USD')).toBe('USD 2,500.00');
  });
});

describe('formatDate', () => {
  it('renders an ISO date as "D Mon YYYY"', () => {
    expect(formatDate('2026-09-10')).toBe('10 Sep 2026');
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDate('2025-12-31')).toBe('31 Dec 2025');
  });

  it('returns the input unchanged when it is not an ISO date', () => {
    expect(formatDate('yesterday')).toBe('yesterday');
    expect(formatDate('')).toBe('');
    expect(formatDate('2026-09')).toBe('2026-09');
  });
});

describe('toIsoDate', () => {
  it('formats a Date as YYYY-MM-DD in local time with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 8, 10))).toBe('2026-09-10');
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
  });

  it('round-trips through formatDate', () => {
    expect(formatDate(toIsoDate(new Date(2026, 2, 7)))).toBe('7 Mar 2026');
  });
});

describe('formatAmountShort', () => {
  const { formatAmountShort } = require('../src/theme') as typeof import('../src/theme');
  it('drops decimals and groups thousands', () => {
    expect(formatAmountShort(12500.49)).toBe('PKR 12,500');
    expect(formatAmountShort(999.5)).toBe('PKR 1,000');
    expect(formatAmountShort(-42)).toBe('-PKR 42');
  });
});

describe('formatDateFriendly', () => {
  const { formatDateFriendly } = require('../src/theme') as typeof import('../src/theme');
  const now = new Date(2026, 8, 10); // 10 Sep 2026, local time
  it('says Today / Yesterday', () => {
    expect(formatDateFriendly('2026-09-10', now)).toBe('Today');
    expect(formatDateFriendly('2026-09-09', now)).toBe('Yesterday');
  });
  it('omits the year inside the current year and keeps it otherwise', () => {
    expect(formatDateFriendly('2026-03-02', now)).toBe('2 Mar');
    expect(formatDateFriendly('2025-12-31', now)).toBe('31 Dec 2025');
  });
});
