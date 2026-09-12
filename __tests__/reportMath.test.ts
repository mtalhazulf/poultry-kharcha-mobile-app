import {
  buildChartBars,
  compareMonths,
  comparisonPeriod,
  dailyAverage,
  daysInMonth,
  describeDailySpend,
  elapsedDays,
  formatDayMonth,
  formatDeltaPercent,
  formatShare,
  monthId,
  monthLabel,
  monthOf,
  monthRange,
  shareOf,
  shiftMonth,
  spendDelta,
} from '../src/components/reports/reportMath';

const TODAY = new Date(2026, 8, 12, 15, 30); // 12 Sep 2026, local time
const SEPTEMBER = { year: 2026, month: 8 };

describe('months', () => {
  it('reads the month of a date and labels it', () => {
    expect(monthOf(TODAY)).toEqual(SEPTEMBER);
    expect(monthLabel(SEPTEMBER)).toBe('September 2026');
    expect(monthId(SEPTEMBER)).toBe('2026-09');
  });

  it('steps across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2025, month: 11 }, 1)).toEqual({ year: 2026, month: 0 });
    expect(shiftMonth(SEPTEMBER, -13)).toEqual({ year: 2025, month: 7 });
  });

  it('orders months', () => {
    expect(compareMonths(SEPTEMBER, { year: 2026, month: 9 })).toBeLessThan(0);
    expect(compareMonths(SEPTEMBER, { year: 2025, month: 11 })).toBeGreaterThan(0);
    expect(compareMonths(SEPTEMBER, { year: 2026, month: 8 })).toBe(0);
  });

  it('builds inclusive month ranges, including leap years', () => {
    expect(monthRange(SEPTEMBER)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthRange({ year: 2028, month: 1 })).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange({ year: 2026, month: 11 })).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(daysInMonth({ year: 2026, month: 1 })).toBe(28);
  });

  it('counts elapsed days for averages', () => {
    expect(elapsedDays(SEPTEMBER, TODAY)).toBe(12);
    expect(elapsedDays({ year: 2026, month: 7 }, TODAY)).toBe(31);
    expect(elapsedDays({ year: 2026, month: 9 }, TODAY)).toBe(0);
  });
});

describe('comparisonPeriod', () => {
  it('compares the month in progress with the same days of the previous month', () => {
    expect(comparisonPeriod(SEPTEMBER, TODAY)).toEqual({
      from: '2026-08-01',
      to: '2026-08-12',
      label: '1–12 Aug',
      wholeMonth: false,
    });
  });

  it('compares a finished month with the whole previous month', () => {
    expect(comparisonPeriod({ year: 2026, month: 7 }, TODAY)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
      label: 'July',
      wholeMonth: true,
    });
  });

  it('caps the span at the length of a shorter previous month', () => {
    const march31 = new Date(2026, 2, 31);
    expect(comparisonPeriod({ year: 2026, month: 2 }, march31)).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
      label: 'February',
      wholeMonth: true,
    });
  });

  it('handles the first day of a year', () => {
    expect(comparisonPeriod({ year: 2026, month: 0 }, new Date(2026, 0, 1))).toEqual({
      from: '2025-12-01',
      to: '2025-12-01',
      label: '1 Dec',
      wholeMonth: false,
    });
  });
});

describe('spendDelta', () => {
  it('reports increases and decreases in whole percent', () => {
    expect(spendDelta(120, 100)).toEqual({ direction: 'up', percent: 20 });
    expect(spendDelta(80, 100)).toEqual({ direction: 'down', percent: 20 });
    expect(spendDelta(0, 100)).toEqual({ direction: 'down', percent: 100 });
    expect(spendDelta(3333, 3000)).toEqual({ direction: 'up', percent: 11 });
  });

  it('treats changes that round to zero as flat', () => {
    expect(spendDelta(100.3, 100)).toEqual({ direction: 'flat', percent: 0 });
    expect(spendDelta(100, 100)).toEqual({ direction: 'flat', percent: 0 });
  });

  it('has no percentage when there was nothing to compare with', () => {
    expect(spendDelta(50, 0)).toEqual({ direction: 'up', percent: null });
    expect(spendDelta(0, 0)).toEqual({ direction: 'flat', percent: 0 });
    expect(spendDelta(Number.NaN, 100)).toEqual({ direction: 'down', percent: 100 });
  });

  it('formats and caps the percentage', () => {
    expect(formatDeltaPercent(12)).toBe('12%');
    expect(formatDeltaPercent(1500)).toBe('>999%');
  });
});

describe('shares', () => {
  it('computes clamped shares of a total', () => {
    expect(shareOf(25, 100)).toBe(25);
    expect(shareOf(150, 100)).toBe(100);
    expect(shareOf(5, 0)).toBe(0);
    expect(shareOf(-5, 100)).toBe(0);
  });

  it('formats shares without overstating', () => {
    expect(formatShare(25, 100)).toBe('25%');
    expect(formatShare(1, 3)).toBe('33%');
    expect(formatShare(0.4, 100)).toBe('<1%');
    expect(formatShare(0, 100)).toBe('0%');
    expect(formatShare(99.7, 100)).toBe('>99%');
    expect(formatShare(100, 100)).toBe('100%');
  });

  it('averages over elapsed days', () => {
    expect(dailyAverage(3000, 12)).toBe(250);
    expect(dailyAverage(3000, 0)).toBe(0);
    expect(dailyAverage(0, 30)).toBe(0);
  });
});

describe('daily chart', () => {
  const days = [
    { date: '2026-09-01', total: 0 },
    { date: '2026-09-02', total: 10 },
    { date: '2026-09-03', total: 100 },
    { date: '2026-09-04', total: 0.5 },
  ];

  it('scales bars to the busiest day with a floor for small days', () => {
    const { bars, max } = buildChartBars(days, { height: 100, minHeight: 4, highlightDate: '2026-09-03' });
    expect(max).toBe(100);
    expect(bars.map(bar => bar.height)).toEqual([0, 10, 100, 4]);
    expect(bars.map(bar => bar.highlighted)).toEqual([false, false, true, false]);
  });

  it('has flat bars when nothing was spent', () => {
    const { bars, max } = buildChartBars([{ date: '2026-09-01', total: 0 }], { height: 100, minHeight: 4 });
    expect(max).toBe(0);
    expect(bars[0]?.height).toBe(0);
  });

  it('describes the chart for screen readers', () => {
    expect(formatDayMonth('2026-09-03')).toBe('3 Sep');
    expect(describeDailySpend(days, { period: 'September 2026', currency: 'PKR', today: '2026-09-02' })).toBe(
      'Daily spend for September 2026. 3 of 4 days had expenses. Highest PKR 100 on 3 Sep. Today PKR 10.',
    );
    expect(describeDailySpend([], { period: 'August 2026', currency: 'PKR' })).toBe(
      'Daily spend for August 2026. No expenses.',
    );
  });
});
