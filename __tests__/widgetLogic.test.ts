import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getWidgetView,
  isWidgetView,
  rowsForHeight,
  setWidgetView,
  toWidgetRow,
} from '../src/widgets/widgetLogic';
import type { KharchaWithOwner } from '../src/types/models';

function expense(overrides: Partial<KharchaWithOwner> = {}): KharchaWithOwner {
  return {
    id: 'k1',
    org_id: 'org-1',
    owner_id: 'user-1',
    amount: 1000,
    category: 'Feed',
    category_icon: 'wheat',
    note: null,
    expense_date: '2026-09-12',
    receipt_path: null,
    created_at: '2026-09-12T09:00:00.000Z',
    updated_at: '2026-09-12T09:00:00.000Z',
    owner: { id: 'user-1', email: 'ali@example.com', display_name: 'Ali Khan', avatar_url: null },
    ...overrides,
  };
}

describe('isWidgetView', () => {
  it('accepts only quickAdd and recent', () => {
    expect(isWidgetView('quickAdd')).toBe(true);
    expect(isWidgetView('recent')).toBe(true);
    expect(isWidgetView('other')).toBe(false);
    expect(isWidgetView(null)).toBe(false);
  });
});

describe('getWidgetView / setWidgetView', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to quickAdd when nothing is stored', async () => {
    expect(await getWidgetView()).toBe('quickAdd');
  });

  it('persists and reads back the chosen view', async () => {
    await setWidgetView('recent');
    expect(await getWidgetView()).toBe('recent');
    await setWidgetView('quickAdd');
    expect(await getWidgetView()).toBe('quickAdd');
  });

  it('falls back to quickAdd for a corrupted stored value', async () => {
    await AsyncStorage.setItem('mps:widget-view:v1', 'garbage');
    expect(await getWidgetView()).toBe('quickAdd');
  });
});

describe('toWidgetRow', () => {
  it('formats title, amount and the expense deep link', () => {
    const row = toWidgetRow(expense(), 'PKR');
    expect(row).toEqual({
      id: 'k1',
      title: 'Feed',
      subtitle: 'Ali Khan',
      amountText: 'PKR 1,000',
      uri: 'kharcha://expense/k1',
    });
  });

  it('leads with the note when there is one, then the person', () => {
    const row = toWidgetRow(expense({ note: '7 bags' }), 'PKR');
    expect(row.subtitle).toBe('7 bags · Ali Khan');
  });

  it('falls back to email when there is no display name, and to the app currency default', () => {
    const row = toWidgetRow(
      expense({ owner: { id: 'user-1', email: 'ali@example.com', display_name: null, avatar_url: null } }),
      '',
    );
    expect(row.subtitle).toBe('ali@example.com');
    expect(row.amountText).toBe('PKR 1,000');
  });
});

describe('rowsForHeight', () => {
  it('fits more rows into a taller widget, capped at 5', () => {
    expect(rowsForHeight(0)).toBe(1);
    expect(rowsForHeight(72)).toBe(1);
    expect(rowsForHeight(108)).toBe(2);
    expect(rowsForHeight(1000)).toBe(5);
  });
});
