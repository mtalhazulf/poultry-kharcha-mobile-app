/**
 * One person's Khata: their running balance and full entry history. Only
 * they can add to it ("New Borrow") — everyone else sees it read-only,
 * matching the org-wide visibility / self-service-write model in khata.ts.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createKhataEntry, listKhataEntries } from '../api/khata';
import { listOrgMembers } from '../api/members';
import { entriesForPerson } from '../components/khata/khataLogic';
import { parseAmountInput, sanitizeAmountInput } from '../components/expenses/expenseForm';
import { AmountField } from '../components/expenses/AmountField';
import { formatLongDate } from '../components/expenses/expenseListModel';
import { personName } from '../components/team/teamLogic';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { CURRENCY, formatAmount, spacing, toIsoDate } from '../theme';
import type { KhataEntry, OrgMember } from '../types/models';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorBanner,
  ListGroup,
  ListItem,
  LIST_TEXT_INSET,
  LoadingView,
  Money,
  Screen,
  Segmented,
  Sheet,
  TextField,
  type SegmentedOption,
} from '../ui';

type Props = RootStackScreenProps<'PersonKhata'>;

type Sign = 'borrow' | 'repay';

const SIGN_OPTIONS: ReadonlyArray<SegmentedOption<Sign>> = [
  { value: 'borrow', label: 'Borrowed', testID: 'khata-sign-borrow' },
  { value: 'repay', label: 'Repaid', testID: 'khata-sign-repay' },
];

function balanceColor(balance: number): 'dangerText' | 'primaryText' | 'textSecondary' {
  if (balance > 0) {
    return 'dangerText';
  }
  if (balance < 0) {
    return 'primaryText';
  }
  return 'textSecondary';
}

export default function PersonKhataScreen({ route }: Props) {
  const { userId: personId } = route.params;
  const { user } = useAuth();
  const { activeOrg } = useOrg();

  if (!user || !activeOrg) {
    return <LoadingView />;
  }
  return <PersonKhata personId={personId} viewerId={user.id} orgId={activeOrg.id} currency={activeOrg.currency} />;
}

interface ContentProps {
  personId: string;
  viewerId: string;
  orgId: string;
  currency: string;
}

function PersonKhata({ personId, viewerId, orgId, currency: orgCurrency }: ContentProps) {
  const currency = orgCurrency || CURRENCY;
  const isSelf = personId === viewerId;

  const [person, setPerson] = useState<OrgMember | null>(null);
  const [entries, setEntries] = useState<KhataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [sign, setSign] = useState<Sign>('borrow');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const mounted = useRef(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [members, entryList] = await Promise.all([listOrgMembers(orgId), listKhataEntries(orgId)]);
      if (!mounted.current) {
        return;
      }
      setPerson(members.find(member => member.user_id === personId) ?? null);
      setEntries(entryList);
    } catch (err) {
      if (mounted.current) {
        setError(AppError.from(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [orgId, personId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const personEntries = useMemo(() => entriesForPerson(entries, personId), [entries, personId]);
  const balance = useMemo(
    () => Math.round(personEntries.reduce((sum, entry) => sum + entry.amount * 100, 0)) / 100,
    [personEntries],
  );

  const openSheet = useCallback(() => {
    setAmount('');
    setSign('borrow');
    setNote('');
    setAmountError(null);
    setSaveError(null);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (!saving) {
      setSheetOpen(false);
    }
  }, [saving]);

  const onAmountChange = useCallback((text: string) => {
    setAmount(sanitizeAmountInput(text));
    setAmountError(null);
  }, []);

  const save = useCallback(async () => {
    const parsed = parseAmountInput(amount);
    if (!parsed.ok) {
      setAmountError(parsed.error);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await createKhataEntry(orgId, {
        amount: sign === 'repay' ? -parsed.value : parsed.value,
        note: note.trim() || null,
        entryDate: toIsoDate(new Date()),
      });
      if (mounted.current) {
        setSheetOpen(false);
        setSaving(false);
      }
      load();
    } catch (err) {
      if (mounted.current) {
        setSaveError(AppError.from(err));
        setSaving(false);
      }
    }
  }, [amount, sign, note, orgId, load]);

  if (loading && person === null && entries.length === 0) {
    return <LoadingView message="Loading khata" />;
  }

  const name = person ? personName(person.profile) : 'Khata';

  const footer = isSelf ? (
    <Button title="New Borrow" icon="plus" onPress={openSheet} fullWidth testID="khata-new-borrow" />
  ) : undefined;

  return (
    <Screen scroll gap={spacing.xxl} footer={footer} testID="person-khata-screen">
      {error ? <ErrorBanner message={error.message} kind={error.kind} onRetry={load} /> : null}

      <Card style={styles.card}>
        <View style={styles.header}>
          <Avatar name={person?.profile.display_name} email={person?.profile.email} size="lg" />
          <View style={styles.headerText}>
            <AppText variant="headline" numberOfLines={1}>
              {isSelf ? `${name} (you)` : name}
            </AppText>
            <AppText variant="callout" color="textSecondary">
              {balance === 0 ? 'Settled up' : balance > 0 ? 'Owes the organization' : 'Owed by the organization'}
            </AppText>
          </View>
        </View>
        <Divider />
        <Money
          amount={Math.abs(balance)}
          currency={currency}
          variant="amountLarge"
          exact
          color={balanceColor(balance)}
          numberOfLines={1}
          adjustsFontSizeToFit
          testID="khata-balance"
        />
      </Card>

      {personEntries.length === 0 ? (
        <EmptyState icon="arrow-left-right" title="No entries yet" message="Borrow and repay entries will appear here." />
      ) : (
        <ListGroup separatorInset={LIST_TEXT_INSET}>
          {personEntries.map(entry => (
            <ListItem
              key={entry.id}
              title={entry.amount > 0 ? 'Borrowed' : 'Repaid'}
              subtitle={[formatLongDate(entry.entry_date), entry.note].filter(Boolean).join(' · ')}
              trailing={
                <AppText variant="bodyStrong" color={balanceColor(entry.amount)}>
                  {formatAmount(entry.amount, currency)}
                </AppText>
              }
            />
          ))}
        </ListGroup>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="New Borrow"
        testID="khata-sheet"
        footer={
          <Button title="Save" onPress={save} loading={saving} disabled={!amount} fullWidth testID="khata-save" />
        }
      >
        {saveError ? (
          <ErrorBanner message={saveError.message} kind={saveError.kind} onDismiss={() => setSaveError(null)} />
        ) : null}
        <Segmented options={SIGN_OPTIONS} value={sign} onChange={setSign} testID="khata-sign" />
        <AmountField
          currency={currency}
          value={amount}
          onChangeText={onAmountChange}
          error={amountError}
          autoFocus
          testID="khata-amount"
        />
        <TextField
          label="Note"
          optional
          placeholder="What was this for?"
          value={note}
          onChangeText={setNote}
          testID="khata-note"
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xxs },
});
