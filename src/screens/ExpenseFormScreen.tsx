/**
 * Create (no `kharchaId`) or edit (with `kharchaId`) an expense. The owner
 * check that locks the form for others is cosmetic; RLS on `kharcha` and the
 * `receipts` bucket is what stops them.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { createKharcha, getKharcha, updateKharcha } from '../api/kharcha';
import { CategoryPicker } from '../components/CategoryPicker';
import { AmountField } from '../components/expenses/AmountField';
import {
  amountToInput,
  buildExpensePatch,
  parseAmountInput,
  sanitizeAmountInput,
} from '../components/expenses/expenseForm';
import { formatLongDate } from '../components/expenses/expenseListModel';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { useAuth } from '../context/AuthProvider';
import { useBiometricLock } from '../context/BiometricLockProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import { deleteReceipt, pickReceipt, uploadReceipt, type PickedFile } from '../lib/receipts';
import type { RootStackParamList } from '../navigation/types';
import {
  AppText,
  Banner,
  Button,
  Chip,
  ErrorBanner,
  LoadingView,
  Screen,
  TextField,
  type TextFieldRef,
} from '../ui';
import { CURRENCY, formatAmount, parseIsoDate, spacing, toIsoDate } from '../theme';
import type { KharchaInput, KharchaWithOwner, Organization } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseForm'>;

interface FieldErrors {
  amount?: string;
  category?: string;
}

function isoDaysAgo(days: number): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
}

export default function ExpenseFormScreen({ navigation, route }: Props) {
  const kharchaId = route.params?.kharchaId;
  const { user } = useAuth();
  const { activeOrg } = useOrg();

  if (!user || !activeOrg) {
    return <LoadingView />;
  }
  return (
    <ExpenseForm
      key={kharchaId ?? 'new'}
      navigation={navigation}
      kharchaId={kharchaId}
      userId={user.id}
      org={activeOrg}
    />
  );
}

interface FormProps {
  navigation: Props['navigation'];
  kharchaId: string | undefined;
  userId: string;
  org: Organization;
}

function ExpenseForm({ navigation, kharchaId, userId, org }: FormProps) {
  const isEdit = kharchaId !== undefined;
  const currency = org.currency || CURRENCY;
  const { suspendRelock } = useBiometricLock();
  const noteRef = useRef<TextFieldRef>(null);
  const mountedRef = useRef(true);

  const [existing, setExisting] = useState<KharchaWithOwner | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<AppError | null>(null);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<{ name: string; icon: string | null }>({
    name: '',
    icon: null,
  });
  const [dateIso, setDateIso] = useState(() => isoDaysAgo(0));
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);
  const [receiptError, setReceiptError] = useState<AppError | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!kharchaId) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const row = await getKharcha(kharchaId);
      if (!mountedRef.current) {
        return;
      }
      setExisting(row);
      setAmount(amountToInput(row.amount));
      setCategory({ name: row.category, icon: row.category_icon });
      setDateIso(row.expense_date);
      setNote(row.note ?? '');
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(AppError.from(err));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [kharchaId]);

  useEffect(() => {
    load();
  }, [load]);

  const readOnly = isEdit && existing !== null && existing.owner_id !== userId;
  const locked = readOnly || saving;
  const todayIso = isoDaysAgo(0);
  const yesterdayIso = isoDaysAgo(1);
  const customDate = dateIso !== todayIso && dateIso !== yesterdayIso;

  const onAmountChange = useCallback((text: string) => {
    setAmount(sanitizeAmountInput(text));
    setErrors(prev => (prev.amount ? { ...prev, amount: undefined } : prev));
  }, []);

  const onCategoryChange = useCallback((next: { name: string; icon: string | null }) => {
    setCategory(next);
    setErrors(prev => (prev.category ? { ...prev, category: undefined } : prev));
  }, []);

  const openDatePicker = useCallback(() => {
    const value = parseIsoDate(dateIso) ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        maximumDate: new Date(),
        onValueChange: (_event, selected) => setDateIso(toIsoDate(selected)),
      });
    } else {
      setIosPickerOpen(open => !open);
    }
  }, [dateIso]);

  const pick = useCallback(
    async (source: 'camera' | 'gallery') => {
      setReceiptError(null);
      try {
        // The picker is a separate activity, so the app is in the background
        // while it is open. Without suspendRelock a slow pick comes back to the
        // Lock screen, which replaces the stack and takes this half-typed form
        // (and the picked file) with it.
        const file = await suspendRelock(() => pickReceipt(source));
        if (file && mountedRef.current) {
          setPicked(file);
          setReceiptRemoved(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setReceiptError(AppError.from(err));
        }
      }
    },
    [suspendRelock],
  );

  const removeReceipt = useCallback(() => {
    setPicked(null);
    if (existing?.receipt_path) {
      setReceiptRemoved(true);
    }
  }, [existing]);

  const submit = useCallback(async () => {
    if (saving || readOnly) {
      return;
    }
    const parsed = parseAmountInput(amount);
    const nextErrors: FieldErrors = {};
    if (!parsed.ok) {
      nextErrors.amount = parsed.error;
    }
    if (!category.name.trim()) {
      nextErrors.category = 'Pick an expense type.';
    }
    setErrors(nextErrors);
    if (!parsed.ok || nextErrors.category) {
      return;
    }

    const input: KharchaInput = {
      amount: parsed.value,
      category: category.name,
      categoryIcon: category.icon,
      note: note.trim() || null,
      expenseDate: dateIso,
    };
    setSaving(true);
    setSaveError(null);

    try {
      if (!isEdit) {
        const created = await createKharcha(org.id, input);
        if (picked) {
          try {
            const key = await uploadReceipt(created.id, picked);
            await updateKharcha(created.id, { receiptPath: key });
          } catch (err) {
            // The expense exists; say what did not work and still move on.
            const appErr = AppError.from(err);
            Alert.alert(
              'Receipt not attached',
              `The expense was saved, but the receipt could not be uploaded. ${appErr.message}`,
              [
                {
                  text: 'OK',
                  onPress: () => navigation.replace('ExpenseDetail', { kharchaId: created.id }),
                },
              ],
              { cancelable: false },
            );
            return;
          }
        }
        navigation.replace('ExpenseDetail', { kharchaId: created.id });
        return;
      }

      if (!existing || !kharchaId) {
        return;
      }
      const oldPath = existing.receipt_path;
      let receiptPath: string | null | undefined;
      if (picked) {
        receiptPath = await uploadReceipt(kharchaId, picked);
      } else if (receiptRemoved && oldPath) {
        receiptPath = null;
      }
      const patch = buildExpensePatch(existing, { ...input, receiptPath });
      if (Object.keys(patch).length > 0) {
        await updateKharcha(kharchaId, patch);
      }
      if (oldPath && receiptPath !== undefined && receiptPath !== oldPath) {
        // Best effort: an orphaned object is harmless.
        deleteReceipt(oldPath).catch(() => undefined);
      }
      navigation.goBack();
    } catch (err) {
      if (mountedRef.current) {
        setSaveError(AppError.from(err));
        setSaving(false);
      }
    }
  }, [
    saving,
    readOnly,
    amount,
    category,
    note,
    dateIso,
    isEdit,
    org.id,
    picked,
    navigation,
    existing,
    kharchaId,
    receiptRemoved,
  ]);

  if (loading) {
    return <LoadingView message="Loading expense" />;
  }

  if (isEdit && (loadError || !existing)) {
    return (
      <Screen
        footer={<Button title="Back" variant="secondary" onPress={() => navigation.goBack()} fullWidth />}
      >
        <ErrorBanner
          message={loadError?.message ?? 'Could not load this expense.'}
          kind={loadError?.kind}
          onRetry={load}
        />
      </Screen>
    );
  }

  const parsedPreview = parseAmountInput(amount);
  const amountHelper =
    parsedPreview.ok && parsedPreview.value >= 1000
      ? formatAmount(parsedPreview.value, currency)
      : null;
  const previewPath = receiptRemoved ? null : existing?.receipt_path ?? null;
  const hasFieldErrors = Boolean(errors.amount || errors.category);

  const footer = (
    <>
      {hasFieldErrors ? (
        <AppText variant="caption" color="dangerText" align="center">
          Check the highlighted fields.
        </AppText>
      ) : null}
      <Button
        title={isEdit ? 'Save changes' : 'Save expense'}
        onPress={submit}
        loading={saving}
        disabled={readOnly}
        fullWidth
        testID="form-submit"
      />
    </>
  );

  return (
    <Screen keyboard footer={footer} gap={spacing.xxl}>
      {readOnly ? (
        <Banner
          tone="neutral"
          icon="lock"
          message="Only the person who added this expense can edit it."
        />
      ) : null}
      {saveError ? (
        <ErrorBanner
          message={saveError.message}
          kind={saveError.kind}
          onDismiss={() => setSaveError(null)}
        />
      ) : null}

      <AmountField
        currency={currency}
        value={amount}
        onChangeText={onAmountChange}
        error={errors.amount}
        helperText={amountHelper}
        autoFocus={!isEdit}
        editable={!locked}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => noteRef.current?.focus()}
        testID="form-amount"
      />

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <AppText variant="subhead">Date</AppText>
          <AppText variant="callout" color="textSecondary" numberOfLines={1} style={styles.dateValue}>
            {formatLongDate(dateIso)}
          </AppText>
        </View>
        <View style={styles.chips}>
          <Chip
            label="Today"
            selected={dateIso === todayIso}
            onPress={() => setDateIso(todayIso)}
            disabled={locked}
            testID="date-today"
          />
          <Chip
            label="Yesterday"
            selected={dateIso === yesterdayIso}
            onPress={() => setDateIso(yesterdayIso)}
            disabled={locked}
            testID="date-yesterday"
          />
          <Chip
            label="Pick date"
            icon="calendar"
            selected={customDate}
            onPress={openDatePicker}
            disabled={locked}
            testID="date-pick"
          />
        </View>
        {iosPickerOpen && Platform.OS !== 'android' ? (
          <DateTimePicker
            value={parseIsoDate(dateIso) ?? new Date()}
            mode="date"
            display="inline"
            maximumDate={new Date()}
            onValueChange={(_event, selected) => {
              setDateIso(toIsoDate(selected));
              setIosPickerOpen(false);
            }}
            onDismiss={() => setIosPickerOpen(false)}
          />
        ) : null}
      </View>

      <TextField
        ref={noteRef}
        label="Note"
        optional
        placeholder="What was this for?"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        // No submitBehavior: a multiline field keeps RN's "newline" default, so
        // Enter breaks the line. The sticky footer button is the submit.
        editable={!locked}
        testID="form-note"
      />

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <AppText variant="subhead">Receipt</AppText>
          <AppText variant="caption" color="textTertiary">
            Optional
          </AppText>
        </View>
        {receiptError ? (
          <ErrorBanner
            message={receiptError.message}
            kind={receiptError.kind}
            onDismiss={() => setReceiptError(null)}
          />
        ) : null}
        {readOnly && !picked && !previewPath ? (
          <AppText variant="callout" color="textSecondary">
            No receipt attached.
          </AppText>
        ) : (
          <ReceiptPreview
            path={previewPath}
            localUri={picked?.uri ?? null}
            onTakePhoto={() => pick('camera')}
            onChooseFromGallery={() => pick('gallery')}
            onRemove={readOnly ? undefined : removeReceipt}
            disabled={locked}
            size="compact"
          />
        )}
      </View>

      <CategoryPicker
        orgId={org.id}
        value={category.name}
        icon={category.icon}
        onChange={onCategoryChange}
        error={errors.category}
        disabled={locked}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dateValue: { flexShrink: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
