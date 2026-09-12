import {
  amountToInput,
  buildExpensePatch,
  parseAmountInput,
  sanitizeAmountInput,
} from '../src/components/expenses/expenseForm';
import {
  activeFilterCount,
  applyBaseFilters,
  DEFAULT_EXPENSE_FILTERS,
  describeDelta,
  expenseSubtitle,
  filterExpenses,
  formatDayTitle,
  formatLongDate,
  formatSavedAt,
  formatTime,
  groupByDay,
  matchesScope,
  matchesSearch,
  periodRange,
  personName,
  spendDelta,
  sumAmounts,
  summarizeMonth,
  typeOptionsFor,
  type ExpenseFilters,
} from '../src/components/expenses/expenseListModel';
import type { KharchaWithOwner } from '../src/types/models';

const ME = 'user-me';
const ALI = 'user-ali';
const SARA = 'user-sara';

/** Saturday 12 Sep 2026, 10:00 local time. */
const NOW = new Date(2026, 8, 12, 10, 0, 0);

let seq = 0;
function expense(partial: Partial<KharchaWithOwner> = {}): KharchaWithOwner {
  seq += 1;
  return {
    id: `k${seq}`,
    org_id: 'org-1',
    owner_id: ME,
    amount: 1000,
    category: 'Feed',
    category_icon: 'wheat',
    note: null,
    expense_date: '2026-09-12',
    receipt_path: null,
    created_at: new Date(2026, 8, 12, 9, 30).toISOString(),
    updated_at: new Date(2026, 8, 12, 9, 30).toISOString(),
    owner: { id: ME, email: 'me@example.com', display_name: 'Talha Zulfiqar', avatar_url: null },
    ...partial,
  };
}

const aliProfile = { id: ALI, email: 'ali@example.com', display_name: 'Ali Khan', avatar_url: null };
const saraProfile = { id: SARA, email: 'sara@example.com', display_name: null, avatar_url: null };

function filters(partial: Partial<ExpenseFilters> = {}): ExpenseFilters {
  return { ...DEFAULT_EXPENSE_FILTERS, ...partial };
}

describe('periodRange', () => {
  it('covers whole calendar months and the last 90 days', () => {
    expect(periodRange('this_month', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('last_month', NOW)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(periodRange('last_90_days', NOW)).toEqual({ from: '2026-06-15', to: '2026-09-12' });
    expect(periodRange('all_time', NOW)).toBeNull();
  });

  it('crosses the year in January', () => {
    const january = new Date(2027, 0, 5);
    expect(periodRange('last_month', january)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(periodRange('this_month', new Date(2028, 1, 10))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });
});

describe('activeFilterCount', () => {
  it('counts only what differs from the defaults', () => {
    expect(activeFilterCount(DEFAULT_EXPENSE_FILTERS)).toBe(0);
    expect(activeFilterCount(filters({ period: 'last_month' }))).toBe(1);
    expect(activeFilterCount(filters({ categories: ['Feed', 'Water'], people: [ALI] }))).toBe(2);
  });
});

describe('matchesScope', () => {
  const mine = expense();
  const othersByAli = expense({ owner_id: ALI, owner: aliProfile });

  it('splits mine from everyone else', () => {
    const ctx = { userId: ME, isAdmin: false };
    expect(matchesScope(mine, { ...ctx, scope: 'mine' })).toBe(true);
    expect(matchesScope(othersByAli, { ...ctx, scope: 'mine' })).toBe(false);
    expect(matchesScope(mine, { ...ctx, scope: 'all' })).toBe(true);
    expect(matchesScope(othersByAli, { ...ctx, scope: 'all' })).toBe(true);
  });
});

describe('search and filters', () => {
  const feed = expense({ note: 'Layer and grower feed, 7 bags' });
  const water = expense({
    category: 'Water',
    category_icon: 'droplets',
    owner_id: ALI,
    owner: aliProfile,
    expense_date: '2026-08-20',
  });
  const labour = expense({
    category: 'Labour',
    owner_id: SARA,
    owner: saraProfile,
    expense_date: '2026-05-01',
  });
  const items = [feed, water, labour];

  it('matches type, note and person, every term', () => {
    expect(matchesSearch(feed, 'grower bags', ME)).toBe(true);
    expect(matchesSearch(feed, 'FEED', ME)).toBe(true);
    expect(matchesSearch(feed, 'you', ME)).toBe(true);
    expect(matchesSearch(water, 'ali', ME)).toBe(true);
    expect(matchesSearch(labour, 'sara@example', ME)).toBe(true);
    expect(matchesSearch(feed, 'grower water', ME)).toBe(false);
    expect(matchesSearch(water, '   ', ME)).toBe(true);
  });

  it('applies types and people but not period to the base set', () => {
    const base = applyBaseFilters(items, {
      scope: 'all',
      userId: ME,
      isAdmin: true,
      filters: filters({ categories: ['Water', 'Labour'], people: [SARA], period: 'this_month' }),
    });
    expect(base.map(item => item.id)).toEqual([labour.id]);
  });

  it('combines scope, period and search for the list', () => {
    const query = { scope: 'all' as const, userId: ME, isAdmin: true, now: NOW, search: '' };
    expect(filterExpenses(items, { ...query, filters: filters() })).toHaveLength(3);
    expect(
      filterExpenses(items, { ...query, filters: filters({ period: 'last_month' }) }).map(i => i.id),
    ).toEqual([water.id]);
    expect(
      filterExpenses(items, { ...query, filters: filters({ period: 'last_90_days' }) }).map(i => i.id),
    ).toEqual([feed.id, water.id]);
    expect(
      filterExpenses(items, { ...query, scope: 'mine', filters: filters(), search: 'feed' }),
    ).toEqual([feed]);
  });

  it('lists organization types first, then retired types found on expenses', () => {
    const options = typeOptionsFor(
      [
        { name: 'Feed', icon: 'wheat' },
        { name: 'Water', icon: 'droplets' },
      ],
      [expense({ category: 'Old diesel', category_icon: 'fuel' }), expense({ category: 'Bedding', category_icon: null }), feed],
    );
    expect(options).toEqual([
      { name: 'Feed', icon: 'wheat' },
      { name: 'Water', icon: 'droplets' },
      { name: 'Bedding', icon: null },
      { name: 'Old diesel', icon: 'fuel' },
    ]);
  });
});

describe('groupByDay', () => {
  it('groups newest day first with friendly titles and exact totals', () => {
    const a = expense({ expense_date: '2026-09-12', amount: 0.1 });
    const b = expense({ expense_date: '2026-09-11', amount: 18250 });
    const c = expense({ expense_date: '2026-09-12', amount: 0.2 });
    const d = expense({ expense_date: '2026-09-08', amount: 500 });
    const e = expense({ expense_date: '2025-12-31', amount: 99.99 });
    const sections = groupByDay([d, a, e, b, c], NOW);
    expect(sections.map(s => [s.key, s.title, s.total, s.data.map(i => i.id)])).toEqual([
      ['2026-09-12', 'Today', 0.3, [a.id, c.id]],
      ['2026-09-11', 'Yesterday', 18250, [b.id]],
      ['2026-09-08', 'Tue, 8 Sep', 500, [d.id]],
      ['2025-12-31', 'Wed, 31 Dec 2025', 99.99, [e.id]],
    ]);
  });

  it('returns no sections for no items', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe('summarizeMonth', () => {
  it('totals this month and compares with the same days last month', () => {
    const items = [
      expense({ expense_date: '2026-09-01', amount: 1000 }),
      expense({ expense_date: '2026-09-12', amount: 250.5 }),
      expense({ expense_date: '2026-08-12', amount: 500 }),
      expense({ expense_date: '2026-08-13', amount: 9999 }), // after the same day last month
      expense({ expense_date: '2026-07-31', amount: 7777 }),
    ];
    const summary = summarizeMonth(items, NOW);
    expect(summary.total).toBe(1250.5);
    expect(summary.count).toBe(2);
    expect(summary.previousTotal).toBe(500);
    expect(summary.delta).toEqual({ direction: 'up', percent: 150 });
    expect(summary.daily).toHaveLength(30);
    expect(summary.daily[0]).toEqual({ date: '2026-08-14', total: 0 });
    expect(summary.daily[29]).toEqual({ date: '2026-09-12', total: 250.5 });
    expect(summary.daily.find(day => day.date === '2026-09-01')?.total).toBe(1000);
  });

  it('clamps the comparison window to a shorter previous month', () => {
    const summary = summarizeMonth(
      [
        expense({ expense_date: '2026-03-31', amount: 100 }),
        expense({ expense_date: '2026-02-28', amount: 400 }),
      ],
      new Date(2026, 2, 31),
    );
    expect(summary.previousTotal).toBe(400);
    expect(summary.delta).toEqual({ direction: 'down', percent: 75 });
  });
});

describe('spendDelta and describeDelta', () => {
  it('handles empty, flat, tiny and huge changes', () => {
    expect(spendDelta(0, 0)).toEqual({ direction: 'flat', percent: null });
    expect(spendDelta(100, 0)).toEqual({ direction: 'up', percent: null });
    expect(spendDelta(500, 500)).toEqual({ direction: 'flat', percent: 0 });
    expect(spendDelta(0, 200)).toEqual({ direction: 'down', percent: 100 });
    expect(describeDelta(spendDelta(100, 0))).toBeNull();
    expect(describeDelta(spendDelta(500, 500))?.label).toBe('Same as last month');
    expect(describeDelta(spendDelta(1001, 1000))).toEqual({
      label: '<1% vs last month',
      accessibilityLabel: 'Up less than 1% compared with the same days last month',
    });
    expect(describeDelta(spendDelta(50, 100))?.label).toBe('50% vs last month');
    expect(describeDelta(spendDelta(100000, 10))?.label).toBe('>999% vs last month');
  });

  it('sums money in cents', () => {
    expect(sumAmounts([{ amount: 0.1 }, { amount: 0.2 }, { amount: Number.NaN }])).toBe(0.3);
  });
});

describe('row and date copy', () => {
  it('uses the note when there is one, otherwise the person and time', () => {
    const created = new Date(2026, 8, 12, 15, 45).toISOString();
    expect(expenseSubtitle(expense({ note: ' Feed, 7 bags ', created_at: created }), ME)).toEqual({
      primary: 'Feed, 7 bags',
      secondary: null,
    });
    expect(
      expenseSubtitle(expense({ note: 'Diesel', owner_id: ALI, owner: aliProfile }), ME),
    ).toEqual({ primary: 'Diesel', secondary: 'Ali Khan' });
    expect(expenseSubtitle(expense({ created_at: created }), ME)).toEqual({
      primary: 'You',
      secondary: '3:45 PM',
    });
    expect(
      expenseSubtitle(expense({ owner_id: SARA, owner: null, created_at: created }), ME),
    ).toEqual({ primary: 'Former member', secondary: '3:45 PM' });
  });

  it('names people by display name, then email', () => {
    expect(personName(aliProfile)).toBe('Ali Khan');
    expect(personName(saraProfile)).toBe('sara@example.com');
    expect(personName({ ...saraProfile, display_name: '   ' })).toBe('sara@example.com');
    expect(personName(null)).toBe('Former member');
  });

  it('formats times and dates', () => {
    expect(formatTime(new Date(2026, 8, 12, 0, 5).toISOString())).toBe('12:05 AM');
    expect(formatTime(new Date(2026, 8, 12, 12, 0).toISOString())).toBe('12:00 PM');
    expect(formatTime('not a date')).toBeNull();
    expect(formatDayTitle('2026-09-12', NOW)).toBe('Today');
    expect(formatDayTitle('2026-09-11', NOW)).toBe('Yesterday');
    expect(formatDayTitle('2026-09-10', NOW)).toBe('Thu, 10 Sep');
    expect(formatLongDate('2026-09-12')).toBe('Sat, 12 Sep 2026');
    expect(formatSavedAt(new Date(2026, 8, 12, 9, 5).toISOString(), NOW)).toBe('today at 9:05 AM');
    expect(formatSavedAt(new Date(2026, 8, 11, 18, 0).toISOString(), NOW)).toBe(
      'yesterday at 6:00 PM',
    );
    expect(formatSavedAt(new Date(2026, 8, 2, 18, 0).toISOString(), NOW)).toBe('on 2 Sep at 6:00 PM');
    expect(formatSavedAt(null, NOW)).toBeNull();
  });
});

describe('amount input', () => {
  it('keeps digits, one point and two decimals', () => {
    expect(sanitizeAmountInput('18250')).toBe('18250');
    expect(sanitizeAmountInput('18,250.505')).toBe('18250.50');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
    expect(sanitizeAmountInput('18,5')).toBe('18.5');
    expect(sanitizeAmountInput('18,')).toBe('18.');
    expect(sanitizeAmountInput('PKR 1 250')).toBe('1250');
    expect(sanitizeAmountInput('123456789012')).toBe('1234567890');
  });

  it('parses and explains invalid amounts', () => {
    expect(parseAmountInput('18250')).toEqual({ ok: true, value: 18250 });
    expect(parseAmountInput('1,250.5')).toEqual({ ok: true, value: 1250.5 });
    expect(parseAmountInput('.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseAmountInput('')).toEqual({ ok: false, error: 'Enter an amount.' });
    expect(parseAmountInput('0')).toEqual({ ok: false, error: 'Enter an amount greater than 0.' });
    expect(parseAmountInput('1.234')).toEqual({ ok: false, error: 'Use at most 2 decimal places.' });
    expect(parseAmountInput('12a')).toMatchObject({ ok: false });
    expect(parseAmountInput('10000000000')).toEqual({ ok: false, error: 'Amount is too large.' });
  });

  it('prefills amounts for editing', () => {
    expect(amountToInput(18250)).toBe('18250');
    expect(amountToInput(18250.5)).toBe('18250.50');
    expect(amountToInput(Number.NaN)).toBe('');
  });
});

describe('buildExpensePatch', () => {
  const existing = expense({
    amount: 18250,
    category: 'Feed',
    category_icon: 'wheat',
    note: 'Layer feed',
    expense_date: '2026-09-10',
    receipt_path: 'k/1-receipt.jpg',
  });
  const same = {
    amount: 18250,
    category: 'Feed',
    categoryIcon: 'wheat',
    note: 'Layer feed',
    expenseDate: '2026-09-10',
  };

  it('is empty when nothing changed', () => {
    expect(buildExpensePatch(existing, same)).toEqual({});
    expect(buildExpensePatch(existing, { ...same, note: '  Layer feed ' })).toEqual({});
  });

  it('sends only changed fields, with the icon for a new type', () => {
    expect(
      buildExpensePatch(existing, {
        ...same,
        amount: 18250.5,
        category: 'Water',
        categoryIcon: 'droplets',
        note: '',
        receiptPath: null,
      }),
    ).toEqual({
      amount: 18250.5,
      category: 'Water',
      categoryIcon: 'droplets',
      note: null,
      receiptPath: null,
    });
    expect(buildExpensePatch(existing, { ...same, expenseDate: '2026-09-11' })).toEqual({
      expenseDate: '2026-09-11',
    });
  });
});

declare const __dirname: string;

describe('no emoji in the expenses flow', () => {
  it('keeps screens and components free of emoji', () => {
    const fs = jest.requireActual<{
      readdirSync(path: string): string[];
      readFileSync(path: string, encoding: 'utf8'): string;
    }>('fs');
    const root = `${__dirname}/..`;
    const files = [
      'src/screens/ExpensesScreen.tsx',
      'src/screens/ExpenseFormScreen.tsx',
      'src/screens/ExpenseDetailScreen.tsx',
      'src/components/ExpenseListItem.tsx',
      'src/components/FilterSheet.tsx',
      'src/components/ReceiptPreview.tsx',
      'src/components/CategoryPicker.tsx',
      ...fs.readdirSync(`${root}/src/components/expenses`).map(name => `src/components/expenses/${name}`),
    ];
    for (const file of files) {
      expect({
        file,
        emoji: /\p{Extended_Pictographic}/u.test(fs.readFileSync(`${root}/${file}`, 'utf8')),
      }).toEqual({ file, emoji: false });
    }
  });
});
