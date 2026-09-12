/**
 * One expense: amount, type, date, who added it, note, receipt and edit
 * history. Edit is for the owner; delete for the owner or an admin. The
 * buttons only mirror RLS on `kharcha` and the `receipts` bucket.
 */
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { deleteKharcha, getKharcha } from '../api/kharcha';
import { listKharchaHistory } from '../api/kharchaHistory';
import {
  formatLongDate,
  formatSavedAt,
  personName,
} from '../components/expenses/expenseListModel';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import { readKharchaCache } from '../lib/offlineCache';
import { deleteReceipt } from '../lib/receipts';
import type { RootStackParamList } from '../navigation/types';
import {
  AppText,
  Avatar,
  Banner,
  Button,
  Card,
  CategoryTile,
  Divider,
  EmptyState,
  ErrorBanner,
  ListGroup,
  ListItem,
  LIST_TEXT_INSET,
  LoadingView,
  Money,
  Screen,
  SectionHeader,
} from '../ui';
import { CURRENCY, formatAmount, spacing } from '../theme';
import type { KharchaHistoryEntry, KharchaWithOwner, Organization } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

export default function ExpenseDetailScreen({ navigation, route }: Props) {
  const { kharchaId } = route.params;
  const { user } = useAuth();
  const { activeOrg, isAdmin } = useOrg();

  if (!user || !activeOrg) {
    return <LoadingView />;
  }
  return (
    <ExpenseDetail
      key={kharchaId}
      navigation={navigation}
      kharchaId={kharchaId}
      userId={user.id}
      org={activeOrg}
      isAdmin={isAdmin}
    />
  );
}

interface DetailProps {
  navigation: Props['navigation'];
  kharchaId: string;
  userId: string;
  org: Organization;
  isAdmin: boolean;
}

function ExpenseDetail({ navigation, kharchaId, userId, org, isAdmin }: DetailProps) {
  const currency = org.currency || CURRENCY;
  const [kharcha, setKharcha] = useState<KharchaWithOwner | null>(null);
  const [history, setHistory] = useState<KharchaHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<AppError | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Snapshot timestamp while this row is the cached one (offline). */
  const [offlineAt, setOfflineAt] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    const isCurrent = () => mountedRef.current && seq === requestSeq.current;
    setError(null);
    try {
      const row = await getKharcha(kharchaId);
      if (!isCurrent()) {
        return;
      }
      setKharcha(row);
      setOfflineAt(null);
      const list = await listKharchaHistory(kharchaId).catch(() => null);
      if (isCurrent() && list) {
        setHistory(list);
      }
    } catch (err) {
      const appError = AppError.from(err);
      // The list paints cached rows offline, so a tap must not dead-end here.
      // The snapshot carries the whole row; only the history is lost.
      let recovered = false;
      if (appError.kind === 'network') {
        const cached = await readKharchaCache(userId, org.id).catch(() => null);
        const row = cached?.items.find(item => item.id === kharchaId);
        if (isCurrent() && row) {
          setKharcha(row);
          setHistory([]);
          setOfflineAt(cached?.cachedAt ?? null);
          recovered = true;
        }
      }
      if (isCurrent() && !recovered) {
        setError(appError);
      }
    } finally {
      if (isCurrent()) {
        setLoading(false);
      }
    }
  }, [kharchaId, userId, org.id]);

  // Runs on mount and whenever the screen regains focus (e.g. after Edit).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isOwner = kharcha !== null && kharcha.owner_id === userId;
  const canDelete = isOwner || isAdmin;

  const doDelete = useCallback(async () => {
    if (!kharcha) {
      return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      if (kharcha.receipt_path && isOwner) {
        // Storage lets only the owner remove it, and only while the row exists.
        await deleteReceipt(kharcha.receipt_path).catch(() => undefined);
      }
      await deleteKharcha(kharcha.id);
      navigation.goBack();
    } catch (err) {
      if (mountedRef.current) {
        setActionError(AppError.from(err));
        setDeleting(false);
      }
    }
  }, [kharcha, isOwner, navigation]);

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete expense?', 'This removes the expense and its receipt for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, delete', style: 'destructive', onPress: () => doDelete() },
    ]);
  }, [doDelete]);

  if (loading && !kharcha) {
    return <LoadingView message="Loading expense" />;
  }

  if (!kharcha) {
    const gone = error?.kind === 'not_found' || error?.kind === 'permission';
    return (
      <Screen
        footer={
          <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
        }
      >
        {gone ? (
          <EmptyState
            icon="receipt"
            title="This expense is not available"
            message="It may have been deleted, or it is no longer shared with you."
            fill
          />
        ) : (
          <ErrorBanner
            message={error?.message ?? 'Could not load this expense.'}
            kind={error?.kind}
            onRetry={load}
          />
        )}
      </Screen>
    );
  }

  const ownerLabel = isOwner ? 'you' : personName(kharcha.owner);

  const footer =
    isOwner || canDelete ? (
      <View style={styles.actions}>
        {isOwner ? (
          <Button
            title="Edit"
            icon="pencil"
            variant="secondary"
            onPress={() => navigation.navigate('ExpenseForm', { kharchaId: kharcha.id })}
            disabled={deleting}
            style={styles.action}
            testID="detail-edit"
          />
        ) : null}
        {canDelete ? (
          <Button
            title="Delete"
            icon="trash"
            variant="danger"
            onPress={confirmDelete}
            loading={deleting}
            style={styles.action}
            testID="detail-delete"
          />
        ) : null}
      </View>
    ) : undefined;

  const offline = offlineAt !== null;
  const savedAt = formatSavedAt(offlineAt);

  return (
    <Screen scroll gap={spacing.xxl} footer={footer}>
      {offline ? (
        <Banner
          tone="neutral"
          icon="wifi-off"
          message={
            savedAt
              ? `You're offline. Showing this expense as saved ${savedAt}.`
              : "You're offline. Showing this expense as saved."
          }
          action={{ label: 'Try again', onPress: load }}
          testID="detail-offline"
        />
      ) : null}
      {actionError ? (
        <ErrorBanner
          message={actionError.message}
          kind={actionError.kind}
          onDismiss={() => setActionError(null)}
        />
      ) : null}
      {error ? <ErrorBanner message={error.message} kind={error.kind} onRetry={load} /> : null}

      <Card style={styles.card}>
        <View style={styles.titleRow}>
          <CategoryTile name={kharcha.category} icon={kharcha.category_icon} size="lg" />
          <View style={styles.titleText}>
            <AppText variant="headline" numberOfLines={2}>
              {kharcha.category}
            </AppText>
            <AppText variant="callout" color="textSecondary">
              {formatLongDate(kharcha.expense_date)}
            </AppText>
          </View>
        </View>

        <Money
          amount={kharcha.amount}
          currency={currency}
          variant="amountLarge"
          exact
          numberOfLines={1}
          adjustsFontSizeToFit
          testID="detail-amount"
        />

        <Divider />

        <View style={styles.addedBy}>
          <Avatar
            size="sm"
            name={kharcha.owner?.display_name}
            email={kharcha.owner?.email}
            uri={kharcha.owner?.avatar_url}
          />
          <AppText variant="callout" color="textSecondary" style={styles.addedByText}>
            Added by {ownerLabel}
          </AppText>
        </View>

        {kharcha.note ? (
          <View style={styles.note}>
            <AppText variant="caption" color="textSecondary">
              Note
            </AppText>
            <AppText variant="body" testID="detail-note">
              {kharcha.note}
            </AppText>
          </View>
        ) : null}
      </Card>

      {kharcha.receipt_path ? (
        <View style={styles.section}>
          <SectionHeader title="Receipt" />
          <ReceiptPreview path={kharcha.receipt_path} />
        </View>
      ) : null}

      {history.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="History" />
          <ListGroup separatorInset={LIST_TEXT_INSET}>
            {history.map(entry => (
              <ListItem
                key={entry.id}
                title={`${formatAmount(entry.amount, currency)} · ${entry.category}`}
                subtitle={`Changed by ${personName(entry.editor)} · ${formatSavedAt(entry.edited_at) ?? ''}`}
                leading={
                  <CategoryTile name={entry.category} icon={entry.category_icon} size="sm" />
                }
              />
            ))}
          </ListGroup>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleText: { flex: 1, gap: spacing.xxs },
  addedBy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addedByText: { flex: 1 },
  note: { gap: spacing.xs },
  section: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
