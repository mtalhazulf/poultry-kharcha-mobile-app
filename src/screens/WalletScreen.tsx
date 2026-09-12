/**
 * One person's Wallet: a display-only running balance plus its full history.
 * Every expense the person creates deducts automatically (the
 * `sync_wallet_entry_for_kharcha` trigger); only an org admin can add funds.
 * `route.params.userId` is omitted to view your own wallet.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createWalletTopUp, listWalletEntries } from '../api/wallet';
import { listOrgMembers } from '../api/members';
import { parseAmountInput, sanitizeAmountInput } from '../components/expenses/expenseForm';
import { AmountField } from '../components/expenses/AmountField';
import { formatLongDate } from '../components/expenses/expenseListModel';
import { sumBalance } from '../components/wallet/walletLogic';
import { personName } from '../components/team/teamLogic';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { CURRENCY, formatAmount, spacing } from '../theme';
import type { OrgMember, WalletEntry } from '../types/models';
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
  Sheet,
  TextField,
} from '../ui';

type Props = RootStackScreenProps<'Wallet'>;

function balanceColor(balance: number): 'primaryText' | 'textSecondary' {
  // A wallet running low isn't a problem the way an unpaid Khata balance is,
  // so unlike PersonKhataScreen this never renders in the danger color.
  return balance > 0 ? 'primaryText' : 'textSecondary';
}

export default function WalletScreen({ route }: Props) {
  const targetId = route.params?.userId;
  const { user } = useAuth();
  const { activeOrg, isAdmin } = useOrg();

  if (!user || !activeOrg) {
    return <LoadingView />;
  }
  return (
    <Wallet
      personId={targetId ?? user.id}
      isSelf={(targetId ?? user.id) === user.id}
      isAdmin={isAdmin}
      orgId={activeOrg.id}
      currency={activeOrg.currency}
    />
  );
}

interface ContentProps {
  personId: string;
  isSelf: boolean;
  isAdmin: boolean;
  orgId: string;
  currency: string;
}

function Wallet({ personId, isSelf, isAdmin, orgId, currency: orgCurrency }: ContentProps) {
  const currency = orgCurrency || CURRENCY;

  const [person, setPerson] = useState<OrgMember | null>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);

  const mounted = useRef(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [members, entryList] = await Promise.all([
        listOrgMembers(orgId),
        listWalletEntries(orgId, personId),
      ]);
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

  const balance = sumBalance(entries);

  const openSheet = useCallback(() => {
    setAmount('');
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
      await createWalletTopUp(orgId, personId, { amount: parsed.value, note: note.trim() || null });
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
  }, [amount, note, orgId, personId, load]);

  if (loading && person === null && entries.length === 0) {
    return <LoadingView message="Loading wallet" />;
  }

  const name = person ? personName(person.profile) : 'Wallet';

  const footer = isAdmin ? (
    <Button title="Top up" icon="plus" onPress={openSheet} fullWidth testID="wallet-top-up" />
  ) : undefined;

  return (
    <Screen scroll gap={spacing.xxl} footer={footer} testID="wallet-screen">
      {error ? <ErrorBanner message={error.message} kind={error.kind} onRetry={load} /> : null}

      <Card style={styles.card}>
        {isSelf ? null : (
          <>
            <View style={styles.header}>
              <Avatar name={person?.profile.display_name} email={person?.profile.email} size="lg" />
              <View style={styles.headerText}>
                <AppText variant="headline" numberOfLines={1}>
                  {name}
                </AppText>
                <AppText variant="callout" color="textSecondary">
                  Wallet balance
                </AppText>
              </View>
            </View>
            <Divider />
          </>
        )}
        <Money
          amount={balance}
          currency={currency}
          variant="amountLarge"
          exact
          color={balanceColor(balance)}
          numberOfLines={1}
          adjustsFontSizeToFit
          testID="wallet-balance"
        />
      </Card>

      {entries.length === 0 ? (
        <EmptyState icon="banknote" title="No entries yet" message="Expenses and top-ups will appear here." />
      ) : (
        <ListGroup separatorInset={LIST_TEXT_INSET}>
          {entries.map(entry => {
            const isTopUp = entry.kharcha_id === null;
            return (
              <ListItem
                key={entry.id}
                title={isTopUp ? 'Added funds' : entry.note ?? 'Expense'}
                subtitle={
                  isTopUp
                    ? [formatLongDate(entry.entry_date), entry.note].filter(Boolean).join(' · ')
                    : formatLongDate(entry.entry_date)
                }
                trailing={
                  <AppText variant="bodyStrong" color={entry.amount > 0 ? 'primaryText' : 'dangerText'}>
                    {formatAmount(entry.amount, currency)}
                  </AppText>
                }
              />
            );
          })}
        </ListGroup>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="Top up wallet"
        testID="wallet-sheet"
        footer={
          <Button
            title="Save"
            onPress={save}
            loading={saving}
            disabled={!amount}
            fullWidth
            testID="wallet-save"
          />
        }
      >
        {saveError ? (
          <ErrorBanner message={saveError.message} kind={saveError.kind} onDismiss={() => setSaveError(null)} />
        ) : null}
        <AmountField
          currency={currency}
          value={amount}
          onChangeText={onAmountChange}
          error={amountError}
          autoFocus
          testID="wallet-amount"
        />
        <TextField
          label="Note"
          optional
          placeholder="What's this for?"
          value={note}
          onChangeText={setNote}
          testID="wallet-note"
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
