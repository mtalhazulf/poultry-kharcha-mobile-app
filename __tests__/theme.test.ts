import {
  colors,
  formatAmount,
  formatAmountFixed,
  formatAmountShort,
  formatAmountSmart,
  formatDate,
  formatDateFriendly,
  layout,
  parseIsoDate,
  radius,
  spacing,
  toIsoDate,
  typography,
} from '../src/theme';

describe('formatAmount', () => {
  it('groups thousands and hides decimals for whole amounts', () => {
    expect(formatAmount(18000)).toBe('PKR 18,000');
    expect(formatAmount(1000)).toBe('PKR 1,000');
    expect(formatAmount(999)).toBe('PKR 999');
    expect(formatAmount(0)).toBe('PKR 0');
  });

  it('shows two decimals when there are cents', () => {
    expect(formatAmount(1234567.5)).toBe('PKR 1,234,567.50');
    expect(formatAmount(12.05)).toBe('PKR 12.05');
  });

  it('rounds to two decimals first', () => {
    expect(formatAmount(12.345)).toBe('PKR 12.35');
    expect(formatAmount(0.1 + 0.2)).toBe('PKR 0.30');
    expect(formatAmount(1.005)).toBe('PKR 1.01');
    expect(formatAmount(999.999)).toBe('PKR 1,000');
  });

  it('puts the sign before the currency for negatives', () => {
    expect(formatAmount(-42)).toBe('-PKR 42');
    expect(formatAmount(-1234.5)).toBe('-PKR 1,234.50');
    expect(formatAmount(-0.001)).toBe('PKR 0');
  });

  it('accepts a currency override', () => {
    expect(formatAmount(2500, 'USD')).toBe('USD 2,500');
  });

  it('never renders NaN', () => {
    expect(formatAmount(Number.NaN)).toBe('PKR 0');
  });
});

describe('formatAmountFixed', () => {
  it('always shows two decimals', () => {
    expect(formatAmountFixed(1000)).toBe('PKR 1,000.00');
    expect(formatAmountFixed(-1234.5)).toBe('-PKR 1,234.50');
    expect(formatAmountFixed(-0.001)).toBe('PKR 0.00');
  });
});

describe('formatAmountShort', () => {
  it('drops decimals and groups thousands', () => {
    expect(formatAmountShort(12500.49)).toBe('PKR 12,500');
    expect(formatAmountShort(999.5)).toBe('PKR 1,000');
    expect(formatAmountShort(-42)).toBe('-PKR 42');
  });
});

describe('formatAmountSmart', () => {
  it('is the same as formatAmount', () => {
    expect(formatAmountSmart(2500)).toBe('PKR 2,500');
    expect(formatAmountSmart(1250.5)).toBe('PKR 1,250.50');
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
    expect(formatDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('formatDateFriendly', () => {
  const now = new Date(2026, 8, 10); // 10 Sep 2026, local time

  it('says Today / Yesterday', () => {
    expect(formatDateFriendly('2026-09-10', now)).toBe('Today');
    expect(formatDateFriendly('2026-09-09', now)).toBe('Yesterday');
  });

  it('handles Yesterday across a month boundary', () => {
    expect(formatDateFriendly('2026-02-28', new Date(2026, 2, 1))).toBe('Yesterday');
  });

  it('omits the year inside the current year and keeps it otherwise', () => {
    expect(formatDateFriendly('2026-03-02', now)).toBe('2 Mar');
    expect(formatDateFriendly('2025-12-31', now)).toBe('31 Dec 2025');
  });

  it('passes malformed input through', () => {
    expect(formatDateFriendly('soon', now)).toBe('soon');
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

describe('parseIsoDate', () => {
  it('parses a valid date at local midnight', () => {
    const d = parseIsoDate('2026-09-10');
    expect(d && toIsoDate(d)).toBe('2026-09-10');
  });

  it('rejects malformed and impossible dates', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('10/09/2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });
});

describe('design tokens', () => {
  it('matches the contract palette', () => {
    expect(colors).toMatchObject({
      bg: '#F6F7F9',
      surface: '#FFFFFF',
      surfaceMuted: '#F2F4F7',
      border: '#E4E7EC',
      borderStrong: '#D0D5DD',
      text: '#101828',
      textSecondary: '#475467',
      textTertiary: '#98A2B3',
      primary: '#1B7F5A',
      primaryPressed: '#15664A',
      primarySubtle: '#E7F4EE',
      primaryText: '#136246',
      danger: '#D92D20',
      dangerSubtle: '#FEF3F2',
      warning: '#B54708',
      warningSubtle: '#FFFAEB',
      success: '#067647',
      successSubtle: '#ECFDF3',
      info: '#175CD3',
      infoSubtle: '#EFF8FF',
    });
  });

  it('uses the contract type scale with tabular amounts', () => {
    expect(typography.body).toEqual({ fontSize: 15, lineHeight: 22, fontWeight: '400' });
    expect(typography.overline).toMatchObject({ textTransform: 'uppercase', letterSpacing: 0.6 });
    expect(typography.amountLarge).toMatchObject({ fontSize: 32, lineHeight: 38 });
    expect(typography.amount.fontVariant).toContain('tabular-nums');
    expect(typography.amountLarge.fontVariant).toContain('tabular-nums');
  });

  it('keeps spacing on the 4-pt grid and controls at 40/48/56', () => {
    for (const value of Object.values(spacing)) {
      expect(value === 2 || value % 4 === 0).toBe(true);
    }
    expect(radius).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, full: 999 });
    expect(layout.control).toEqual({ sm: 40, md: 48, lg: 56 });
    expect(layout.icon).toEqual({ sm: 16, md: 20, lg: 24 });
    expect(layout.rowMinHeight).toBe(56);
  });
});
