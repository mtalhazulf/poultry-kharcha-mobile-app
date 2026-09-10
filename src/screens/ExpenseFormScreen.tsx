import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createKharcha, getKharcha, updateKharcha } from '../api/kharcha';
import { CategoryPicker } from '../components/CategoryPicker';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { Button, ErrorBanner, InfoBanner, LoadingView, TextField } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import { deleteReceipt, pickReceipt, uploadReceipt, type PickedFile } from '../lib/receipts';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, formatDate, radius, spacing, toIsoDate, typography } from '../theme';
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

/**
 * Create (no `kharchaId`) or edit (with `kharchaId`) an expense. The owner
 * check that disables the form for non-owners is cosmetic only — RLS on
 * `kharcha` and on the `receipts` bucket is what actually stops them.
 */
export default function ExpenseFormScreen({ navigation, route }: Props) {
  const kharchaId = route.params?.kharchaId;
  const isEdit = kharchaId !== undefined;
  const { user } = useAuth();

  const [existing, setExisting] = useState<Kharcha | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<AppError | null>(null);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const today = useMemo(() => new Date(), []);
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
      setCategory(row.category);
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
    if (!category.trim()) {
      errors.category = 'Pick a category.';
    }
    setFieldErrors(errors);
    if (errors.amount || errors.category) {
      return null;
    }
    return {
      amount: value,
      category: category.trim(),
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
        <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const readOnly = !isOwner;
  const previewPath = receiptRemoved ? null : existing?.receipt_path ?? null;
  const hasReceipt = picked !== null || previewPath !== null;

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
        {readOnly ? <InfoBanner message="Only the owner can edit this expense" /> : null}
        {saveError ? (
          <ErrorBanner
            message={saveError.message}
            kind={saveError.kind}
            onDismiss={() => setSaveError(null)}
          />
        ) : null}

        <TextField
          label="Amount"
          placeholder="0.00"
          value={amount}
          onChangeText={text => {
            setAmount(text);
            if (fieldErrors.amount) {
              setFieldErrors(prev => ({ ...prev, amount: undefined }));
            }
          }}
          keyboardType="decimal-pad"
          editable={!readOnly && !saving}
          error={fieldErrors.amount}
        />

        <CategoryPicker
          value={category}
          onChange={value => {
            if (readOnly || saving) {
              return;
            }
            setCategory(value);
            if (fieldErrors.category) {
              setFieldErrors(prev => ({ ...prev, category: undefined }));
            }
          }}
          error={fieldErrors.category}
        />

        <TextField
          label="Note"
          placeholder="What was this for?"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={styles.noteInput}
          editable={!readOnly && !saving}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change date"
            disabled={readOnly || saving}
            onPress={() => setShowPicker(true)}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
          >
            <Text style={styles.dateText}>{formatDate(toIsoDate(date))}</Text>
          </Pressable>
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

        <View style={styles.field}>
          <Text style={styles.label}>Receipt</Text>
          {hasReceipt ? (
            <ReceiptPreview
              path={previewPath}
              localUri={picked?.uri ?? null}
              onRemove={readOnly ? undefined : removeReceipt}
            />
          ) : (
            <Text style={styles.hint}>No receipt attached.</Text>
          )}
          {!readOnly ? (
            <View style={styles.receiptActions}>
              <Button
                title="Take photo"
                variant="secondary"
                onPress={() => pick('camera')}
                disabled={saving}
                style={styles.receiptButton}
              />
              <Button
                title="Choose from gallery"
                variant="secondary"
                onPress={() => pick('gallery')}
                disabled={saving}
                style={styles.receiptButton}
              />
            </View>
          ) : null}
        </View>

        {readOnly ? (
          <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
        ) : (
          <Button
            title={isEdit ? 'Save changes' : 'Save expense'}
            onPress={submit}
            loading={saving}
            disabled={saving}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  field: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.xs },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  noteInput: { minHeight: 88, paddingTop: spacing.md },
  dateButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  dateText: { ...typography.body },
  pressed: { opacity: 0.85 },
  receiptActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  receiptButton: { flex: 1 },
});
