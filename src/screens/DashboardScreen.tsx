import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ExpenseListItem } from '../components/ExpenseListItem';
import { Fab, FAB_SIZE } from '../components/Fab';
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  FilterSheet,
  OwnershipToggle,
  type Filters,
} from '../components/FilterBar';
import { Button, Card, EmptyState, ErrorBanner, InfoBanner, LoadingView } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { useKharchaList } from '../hooks/useKharchaList';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, formatAmountShort, radius, spacing, toIsoDate, touch, typography } from '../theme';
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
  const { items, loading, refreshing, error, fromCache, cachedAt, refresh, revalidate } =
    useKharchaList();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Realtime keeps the list live, but the socket can drop while the app is
  // backgrounded; a silent refetch on every return to this screen covers the
  // add/edit/delete round-trips regardless.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false; // the hook's initial load already ran
        return;
      }
      revalidate();
    }, [revalidate]),
  );

  const summary = useMemo(() => summarizeThisMonth(items, userId, new Date()), [items, userId]);
  const categories = useMemo(() => [...new Set(items.map(item => item.category))], [items]);
  const visible = useMemo(() => applyFilters(items, filters, userId), [items, filters, userId]);
  const advancedCount = activeFilterCount(filters);

  const openForm = useCallback(() => navigation.navigate('ExpenseForm'), [navigation]);
  const openDetail = useCallback(
    (kharchaId: string) => navigation.navigate('ExpenseDetail', { kharchaId }),
    [navigation],
  );
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  const setOwnership = useCallback(
    (ownership: Filters['ownership']) => setFilters(prev => ({ ...prev, ownership })),
    [],
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
        <Text style={styles.summaryAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatAmountShort(summary.total)}
        </Text>
        <Text style={styles.summaryCaption}>
          {summary.count === 1 ? '1 expense' : `${summary.count} expenses`}
        </Text>
      </Card>

      <View style={styles.filterRow}>
        <View style={styles.toggle}>
          <OwnershipToggle value={filters.ownership} onChange={setOwnership} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filters"
          accessibilityState={{ selected: advancedCount > 0 }}
          onPress={openSheet}
          testID="dashboard-filters"
          style={({ pressed }) => [
            styles.filterButton,
            advancedCount > 0 && styles.filterButtonActive,
            pressed && styles.filterButtonPressed,
          ]}
        >
          <Text style={styles.filterIcon} accessible={false}>
            ⚙️
          </Text>
          {advancedCount > 0 ? (
            <View style={styles.filterDot} accessible={false}>
              <Text style={styles.filterDotText}>{advancedCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );

  const empty = hasAnyItems ? (
    <EmptyState
      emoji="🔍"
      title="Nothing here"
      action={<Button icon="🗂️" title="Show all" variant="secondary" onPress={clearFilters} />}
    />
  ) : (
    <EmptyState emoji="🧾" title="No expenses yet" message="Tap Add to write your first one" />
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
      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        categories={categories}
        onChange={setFilters}
        onClose={closeSheet}
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
  header: { gap: spacing.md, marginBottom: spacing.md },
  banner: { marginBottom: 0 },
  summary: { gap: spacing.xs, alignItems: 'center' },
  summaryLabel: { ...typography.label },
  summaryAmount: { ...typography.display, color: colors.primary },
  summaryCaption: { ...typography.caption },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggle: { flex: 1 },
  filterButton: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterButtonPressed: { opacity: 0.7 },
  filterIcon: { fontSize: 26 },
  filterDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDotText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '800' },
  separator: { height: spacing.md },
});
