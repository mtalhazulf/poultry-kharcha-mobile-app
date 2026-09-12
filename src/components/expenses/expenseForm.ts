/**
 * Pure helpers for the expense form: amount input handling and the partial
 * update sent when editing. Unit tested in __tests__/expenses.test.ts.
 */
import type { Kharcha, KharchaInput } from '../../types/models';

/** Whole digits accepted; the API rejects 1e10 and above. */
export const MAX_AMOUNT_DIGITS = 10;

export type AmountParseResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Keeps what a person can mean by an amount while typing or pasting: digits,
 * one decimal point, at most two decimals. A comma followed by at most two
 * digits (and no point) is a decimal comma ("18,5"); other commas are
 * thousands separators ("18,250").
 */
export function sanitizeAmountInput(text: string): string {
  let raw = text.replace(/\s/g, '');
  if (!raw.includes('.')) {
    const lastComma = raw.lastIndexOf(',');
    if (lastComma !== -1 && raw.length - lastComma - 1 <= 2) {
      raw = `${raw.slice(0, lastComma)}.${raw.slice(lastComma + 1)}`;
    }
  }
  const stripped = raw.replace(/[^\d.]/g, '');
  const dot = stripped.indexOf('.');
  if (dot === -1) {
    return stripped.slice(0, MAX_AMOUNT_DIGITS);
  }
  const whole = stripped.slice(0, dot).slice(0, MAX_AMOUNT_DIGITS);
  const fraction = stripped
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, 2);
  return `${whole}.${fraction}`;
}

export function parseAmountInput(text: string): AmountParseResult {
  const cleaned = text.replace(/[\s,]/g, '');
  if (cleaned === '' || cleaned === '.') {
    return { ok: false, error: 'Enter an amount.' };
  }
  if (!/^\d*\.?\d*$/.test(cleaned)) {
    return { ok: false, error: 'Enter a valid amount, like 1250 or 1250.50.' };
  }
  const fraction = cleaned.split('.')[1] ?? '';
  if (fraction.length > 2) {
    return { ok: false, error: 'Use at most 2 decimal places.' };
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Enter a valid amount, like 1250 or 1250.50.' };
  }
  if (value <= 0) {
    return { ok: false, error: 'Enter an amount greater than 0.' };
  }
  if (value >= 1e10) {
    return { ok: false, error: 'Amount is too large.' };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

/** Prefill for editing: "18250" for whole amounts, "18250.50" otherwise. */
export function amountToInput(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '';
  }
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/**
 * Only the fields that changed, for `updateKharcha`. A changed type carries
 * its icon; `receiptPath` is compared only when the draft sets it.
 */
export function buildExpensePatch(existing: Kharcha, draft: KharchaInput): Partial<KharchaInput> {
  const patch: Partial<KharchaInput> = {};
  if (Math.round(existing.amount * 100) !== Math.round(draft.amount * 100)) {
    patch.amount = draft.amount;
  }
  const category = draft.category.trim();
  if (existing.category !== category) {
    patch.category = category;
    patch.categoryIcon = draft.categoryIcon;
  }
  const note = draft.note?.trim() || null;
  if ((existing.note ?? null) !== note) {
    patch.note = note;
  }
  if (existing.expense_date !== draft.expenseDate) {
    patch.expenseDate = draft.expenseDate;
  }
  if (draft.receiptPath !== undefined && draft.receiptPath !== existing.receipt_path) {
    patch.receiptPath = draft.receiptPath;
  }
  return patch;
}
