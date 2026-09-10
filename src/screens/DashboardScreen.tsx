import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ExpenseListItem } from '../components/ExpenseListItem';
import { Fab, FAB_SIZE } from '../components/Fab';
import { applyFilters, DEFAULT_FILTERS, FilterBar, type Filters } from '../components/FilterBar';
import { Button, Card, EmptyState, ErrorBanner, InfoBanner, LoadingView } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { useKharchaList } from '../hooks/useKharchaList';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, formatAmount, spacing, toIsoDate, typography } from '../theme';
import type { Kharcha } from '../types/models';

type Props = RootStackScreenProps<'Dashboard'>;

function formatCachedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${toIsoDate(date)} ${hh}:${mm}`;
}

/** Sum + count of the user's OWN expenses dated within the current month. */
function summarizeThisMonth(items: Kharcha[], userId: string, now: Date) {
  const from = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  let total = 0;
  let count = 0;
  for (const item of items) {
    if (item.owner_id === userId && item.expense_date >= from && item.expense_date <= to) {
      total += item.amount;
      count += 1;
    }
  }
  return { total, count };
}

export default function DashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  if (!userId) {
    // The navigator only mounts this screen with a session; this guards the
    // brief window while the auth context is still resolving.
    return <LoadingView />;
  }
  return <DashboardContent userId={userId} navigation={navigation} />;
}

function DashboardContent({ userId, navigation }: { userId: string } & Pick<Props, 'navigation'>) {
  const { items, loading, refreshing, error, fromCache, cachedAt, refresh } = useKharchaList();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const summary = useMemo(() => summarizeThisMonth(items, userId, new Date()), [items, userId]);
  const categories = useMemo(() => [...new Set(items.map(item => item.category))], [items]);
  const visible = useMemo(() => applyFilters(items, filters, userId), [items, filters, userId]);

  const openForm = useCallback(() => navigation.navigate('ExpenseForm'), [navigation]);
  const openDetail = useCallback(
    (kharchaId: string) => navigation.navigate('ExpenseDetail', { kharchaId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Kharcha }) => (
      <ExpenseListItem
        item={item}
        isOwner={item.owner_id === userId}
        onPress={() => openDetail(item.id)}
      />
    ),
    [userId, openDetail],
  );

  const isOffline = fromCache && error?.kind === 'network';
  const otherError = error && !isOffline ? error : null;
  const hasAnyItems = items.length > 0;

  if (loading && !hasAnyItems && !error) {
    return <LoadingView message="Loading expenses…" />;
  }

  const header = (
    <View style={styles.header}>
      {isOffline && cachedAt ? (
        <InfoBanner
          tone="warning"
          style={styles.banner}
          message={`You're offline — showing expenses saved on ${formatCachedAt(cachedAt)}`}
        />
      ) : null}
      {otherError ? (
        <ErrorBanner
          message={otherError.message}
          kind={otherError.kind}
          onRetry={refresh}
          style={styles.banner}
        />
      ) : null}
      <Card style={styles.summary}>
        <Text style={styles.summaryLabel}>This month</Text>
        <Text style={styles.summaryAmount}>{formatAmount(summary.total)}</Text>
        <Text style={styles.summaryCaption}>
          {summary.count === 1 ? '1 expense' : `${summary.count} expenses`} of yours
        </Text>
      </Card>
      <Text style={styles.sectionTitle}>Expenses</Text>
      <FilterBar filters={filters} onChange={setFilters} categories={categories} />
    </View>
  );

  const empty = hasAnyItems ? (
    <EmptyState
      title="Nothing matches these filters"
      message="Try a wider date range or a different category."
      action={
        <Button
          title="Clear filters"
          variant="secondary"
          onPress={() => setFilters(DEFAULT_FILTERS)}
        />
      }
    />
  ) : (
    <EmptyState
      title="No expenses yet"
      message="Add your first expense to start tracking."
      action={<Button title="Add expense" onPress={openForm} />}
    />
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[styles.content, visible.length === 0 && styles.contentEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />
        }
        keyboardShouldPersistTaps="handled"
      />
      <Fab onPress={openForm} />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: FAB_SIZE + spacing.xl * 2,
  },
  contentEmpty: { flexGrow: 1 },
  header: {
    marginHorizontal: -spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  banner: { marginHorizontal: spacing.lg, marginBottom: 0 },
  summary: { marginHorizontal: spacing.lg, gap: spacing.xs },
  summaryLabel: { ...typography.label },
  summaryAmount: { ...typography.title, fontSize: 28 },
  summaryCaption: { ...typography.caption },
  sectionTitle: { ...typography.heading, paddingHorizontal: spacing.lg },
  separator: { height: spacing.md },
});
