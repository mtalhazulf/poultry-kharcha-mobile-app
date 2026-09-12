import {
  parseExpenseDeepLink,
  setPendingDeepLink,
  takePendingDeepLink,
} from '../src/lib/pendingDeepLink';

describe('parseExpenseDeepLink', () => {
  it('parses the new-expense link', () => {
    expect(parseExpenseDeepLink('kharcha://expense/new')).toEqual({ screen: 'ExpenseForm' });
  });

  it('parses an expense detail link', () => {
    expect(parseExpenseDeepLink('kharcha://expense/k1')).toEqual({
      screen: 'ExpenseDetail',
      kharchaId: 'k1',
    });
  });

  it('decodes an encoded id', () => {
    expect(parseExpenseDeepLink('kharcha://expense/a%2Fb')).toEqual({
      screen: 'ExpenseDetail',
      kharchaId: 'a/b',
    });
  });

  it('ignores query strings and trailing slashes', () => {
    expect(parseExpenseDeepLink('kharcha://expense/k1?from=widget')).toEqual({
      screen: 'ExpenseDetail',
      kharchaId: 'k1',
    });
  });

  it('returns null for unrelated URLs, including the auth callback', () => {
    expect(parseExpenseDeepLink('kharcha://auth/callback?code=abc')).toBeNull();
    expect(parseExpenseDeepLink('https://example.com')).toBeNull();
    expect(parseExpenseDeepLink('kharcha://expense')).toBeNull();
  });
});

describe('pending deep link store', () => {
  it('holds the most recently set link until it is taken', () => {
    expect(takePendingDeepLink()).toBeNull();
    setPendingDeepLink('kharcha://expense/new');
    expect(takePendingDeepLink()).toEqual({ screen: 'ExpenseForm' });
    // Taken once; a second read finds nothing left.
    expect(takePendingDeepLink()).toBeNull();
  });

  it('ignores an unrelated URL rather than clearing an existing pending link', () => {
    setPendingDeepLink('kharcha://expense/k1');
    setPendingDeepLink('kharcha://auth/callback?code=abc');
    expect(takePendingDeepLink()).toEqual({ screen: 'ExpenseDetail', kharchaId: 'k1' });
  });
});
