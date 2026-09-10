import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createKharcha, getKharcha, updateKharcha } from '../api/kharcha';
import { CategoryPicker } from '../components/CategoryPicker';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { Button, Chip, ErrorBanner, InfoBanner, LoadingView, TextField } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import { deleteReceipt, pickReceipt, uploadReceipt, type PickedFile } from '../lib/receipts';
import type { RootStackScreenProps } from '../navigation/types';
import { CURRENCY, colors, formatDateFriendly, spacing, toIsoDate, typography } from '../theme';
import type { Kharcha, KharchaInput } from '../types/models';

type Props = RootStackScreenProps<'ExpenseForm'>;

interface FieldErrors {
  amount?: string;
  category?: string;
}

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function parseDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) {
    return new Date();
  }
  return new Date(y, m - 1, d);
}

function daysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(from.getDate() - days);
  return d;
}

/**
 * Create (no `kharchaId`) or edit (with `kharchaId`) an expense. The owner
 * check that disables the form for non-owners is cosmetic only — RLS on
 * `kharcha` and on the `receipts` bucket is what actually stops them.
 */
export default function ExpenseFormScreen({ navigation, route }: Props) {
  const kharchaId = route.params?.kharchaId;
  const isEdit = kharchaId !== undefined;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [existing, setExisting] = useState<Kharcha | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<AppError | null>(null);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<{ name: string; icon: string | null }>({
    name: '',
    icon: null,
  });
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(today), [today]);
  const yesterdayIso = useMemo(() => toIsoDate(daysAgo(today, 1)), [today]);
  const isOwner = !isEdit || (existing !== null && user !== null && existing.owner_id === user.id);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit expense' : 'New expense' });
  }, [navigation, isEdit]);

  const load = useCallback(async () => {
    if (!kharchaId) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const row = await getKharcha(kharchaId);
      setExisting(row);
      setAmount(row.amount.toFixed(2));
      setCategory({ name: row.category, icon: row.category_icon });
      setNote(row.note ?? '');
      setDate(parseDate(row.expense_date));
    } catch (err) {
      setLoadError(AppError.from(err));
    } finally {
      setLoading(false);
    }
  }, [kharchaId]);

  useEffect(() => {
    load();
  }, [load]);

  const onDateChange = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    // Android's dialog dismisses itself; unmount our instance either way.
    setShowPicker(false);
    if (event.type === 'set' && selected) {
      setDate(selected);
    }
  }, []);

  const pick = useCallback(async (source: 'camera' | 'gallery') => {
    setSaveError(null);
    try {
      const file = await pickReceipt(source);
      if (file) {
        setPicked(file);
        setReceiptRemoved(false);
      }
    } catch (err) {
      setSaveError(AppError.from(err));
    }
  }, []);

  const removeReceipt = useCallback(() => {
    setPicked(null);
    if (existing?.receipt_path) {
      setReceiptRemoved(true);
    }
  }, [existing]);

  const validate = useCallback((): KharchaInput | null => {
    const errors: FieldErrors = {};
    const trimmedAmount = amount.trim();
    const value = Number(trimmedAmount);
    if (!AMOUNT_RE.test(trimmedAmount) || !(value > 0)) {
      errors.amount = 'Enter an amount greater than 0 with at most 2 decimals.';
    }
    if (!category.name.trim()) {
      errors.category = 'Pick a category.';
    }
    setFieldErrors(errors);
    if (errors.amount || errors.category) {
      return null;
    }
    return {
      amount: value,
      category: category.name.trim(),
      category_icon: category.icon,
      note: note.trim() || null,
      expense_date: toIsoDate(date),
    };
  }, [amount, category, note, date]);

  const submit = useCallback(async () => {
    const input = validate();
    if (!input || saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (!isEdit) {
        const created = await createKharcha(input);
        if (picked) {
          try {
            const key = await uploadReceipt(created.id, picked);
            await updateKharcha(created.id, { receipt_path: key });
          } catch (err) {
            // The row exists; surface the partial failure but still move on.
            const appErr = AppError.from(err);
            const message = `Expense saved, but the receipt upload failed: ${appErr.message}`;
            setSaveError(new AppError(appErr.kind, message, err));
            setSaving(false);
            Alert.alert('Receipt not uploaded', message, [
              {
                text: 'OK',
                onPress: () => navigation.replace('ExpenseDetail', { kharchaId: created.id }),
              },
            ]);
            return;
          }
        }
        navigation.replace('ExpenseDetail', { kharchaId: created.id });
        return;
      }

      // Edit mode.
      const id = kharchaId;
      const oldPath = existing?.receipt_path ?? null;
      await updateKharcha(id, input);
      if (picked) {
        const key = await uploadReceipt(id, picked);
        await updateKharcha(id, { receipt_path: key });
        if (oldPath && oldPath !== key) {
          // Best effort: an orphaned object is harmless.
          deleteReceipt(oldPath).catch(() => undefined);
        }
      } else if (receiptRemoved && oldPath) {
        await updateKharcha(id, { receipt_path: null });
        deleteReceipt(oldPath).catch(() => undefined);
      }
      navigation.goBack();
    } catch (err) {
      setSaveError(AppError.from(err));
      setSaving(false);
    }
  }, [validate, saving, isEdit, picked, navigation, kharchaId, existing, receiptRemoved]);

  if (loading) {
    return <LoadingView message="Loading expense…" />;
  }

  if (isEdit && loadError) {
    return (
      <View style={styles.centered}>
        <ErrorBanner message={loadError.message} kind={loadError.kind} onRetry={load} />
        <Button
          title="Back"
          icon="↩️"
          size="lg"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const readOnly = !isOwner;
  const locked = readOnly || saving;
  const previewPath = receiptRemoved ? null : existing?.receipt_path ?? null;
  const hasReceipt = picked !== null || previewPath !== null;

  const dateIso = toIsoDate(date);
  const isToday = dateIso === todayIso;
  const isYesterday = dateIso === yesterdayIso;
  const isOtherDate = !isToday && !isYesterday;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {readOnly ? <InfoBanner icon="🔒" message="Only the owner can edit this expense" /> : null}
        {saveError ? (
          <ErrorBanner
            message={saveError.message}
            kind={saveError.kind}
            onDismiss={() => setSaveError(null)}
          />
        ) : null}

        {/* Amount — the one number that matters, so it is the biggest thing on screen. */}
        <View style={styles.block}>
          <Text style={styles.label}>Amount</Text>
          <View style={[styles.amountRow, fieldErrors.amount ? styles.amountRowError : null]}>
            <Text style={styles.currency}>{CURRENCY}</Text>
            <TextInput
              testID="form-amount"
              accessibilityLabel="Amount"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={text => {
                setAmount(text);
                if (fieldErrors.amount) {
                  setFieldErrors(prev => ({ ...prev, amount: undefined }));
                }
              }}
              keyboardType="decimal-pad"
              autoFocus={!isEdit}
              editable={!locked}
              style={styles.amountInput}
            />
          </View>
          {fieldErrors.amount ? <Text style={styles.error}>{fieldErrors.amount}</Text> : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>What for?</Text>
          <CategoryPicker
            value={category.name}
            icon={category.icon}
            onChange={next => {
              if (locked) {
                return;
              }
              setCategory(next);
              if (fieldErrors.category) {
                setFieldErrors(prev => ({ ...prev, category: undefined }));
              }
            }}
            error={fieldErrors.category}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>When?</Text>
          <View style={styles.chipRow}>
            <Chip
              label="Today"
              icon="📅"
              selected={isToday}
              onPress={() => {
                if (!locked) {
                  setDate(new Date());
                }
              }}
              testID="date-today"
            />
            <Chip
              label="Yesterday"
              icon="🕘"
              selected={isYesterday}
              onPress={() => {
                if (!locked) {
                  setDate(daysAgo(new Date(), 1));
                }
              }}
              testID="date-yesterday"
            />
            <Chip
              label={isOtherDate ? formatDateFriendly(dateIso, today) : 'Other date'}
              icon="🗓️"
              selected={isOtherDate}
              onPress={() => {
                if (!locked) {
                  setShowPicker(true);
                }
              }}
              testID="date-other"
            />
          </View>
          {showPicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              maximumDate={today}
              onChange={onDateChange}
            />
          ) : null}
        </View>

        <TextField
          label="Note (optional)"
          icon="📝"
          testID="form-note"
          placeholder="What was this for?"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={styles.noteInput}
          editable={!locked}
        />

        <View style={styles.block}>
          <Text style={styles.label}>Receipt (optional)</Text>
          {hasReceipt ? (
            <ReceiptPreview
              path={previewPath}
              localUri={picked?.uri ?? null}
              onRemove={readOnly ? undefined : removeReceipt}
            />
          ) : readOnly ? (
            <Text style={styles.hint}>No receipt</Text>
          ) : (
            <View style={styles.receiptActions}>
              <Button
                title="Photo"
                testID="receipt-camera"
                icon="📷"
                variant="secondary"
                onPress={() => pick('camera')}
                disabled={saving}
                style={styles.receiptButton}
              />
              <Button
                title="Gallery"
                testID="receipt-gallery"
                icon="🖼️"
                variant="secondary"
                onPress={() => pick('gallery')}
                disabled={saving}
                style={styles.receiptButton}
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {readOnly ? (
          <Button
            title="Back"
            icon="↩️"
            size="lg"
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
        ) : (
          <Button
            title={isEdit ? 'Save changes' : 'Save'}
            icon="✅"
            size="lg"
            testID="form-submit"
            onPress={submit}
            loading={saving}
            disabled={saving}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  block: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm },
  hint: { ...typography.caption },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: spacing.xs,
  },
  amountRowError: { borderBottomColor: colors.danger },
  currency: { ...typography.heading, color: colors.textMuted },
  amountInput: {
    flex: 1,
    minHeight: 64,
    paddingVertical: 0,
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  noteInput: { minHeight: 88, paddingTop: spacing.md },
  receiptActions: { flexDirection: 'row', gap: spacing.sm },
  receiptButton: { flex: 1 },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
