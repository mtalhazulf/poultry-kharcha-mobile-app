/**
 * Expenses tab: this month's summary, scope and filters, and every expense
 * the person may see grouped by day. RLS decides what arrives (admins get the
 * whole organization, members their own plus what is shared with them).
 */
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listOrgMembers, memberDisplayName } from '../api/members';
import { AppHeader } from '../components/AppHeader';
import { ExpenseListItem } from '../components/ExpenseListItem';
import { ExpenseListSkeleton } from '../components/expenses/ExpenseListSkeleton';
import { ExpenseSummaryCard } from '../components/expenses/ExpenseSummaryCard';
import {
  activeFilterCount,
  applyBaseFilters,
  applyPeriodAndSearch,
  DEFAULT_EXPENSE_FILTERS,
  formatSavedAt,
  groupByDay,
  summarizeMonth,
  typeOptionsFor,
  type ExpenseFilters,
  type ExpenseScope,
  type ExpenseSection,
} from '../components/expenses/expenseListModel';
import { FilterSheet, type PersonOption } from '../components/FilterSheet';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { useCategories } from '../hooks/useCategories';
import { useKharchaList } from '../hooks/useKharchaList';
import { AppError } from '../lib/errors';
import {
  AppText,
  Banner,
  EmptyState,
  ErrorBanner,
  Fab,
  IconButton,
  LoadingView,
  Screen,
  Segmented,
  TextField,
  type SegmentedOption,
} from '../ui';
import { colors, CURRENCY, formatAmount, layout, spacing } from '../theme';
import type { KharchaWithOwner, OrgMember, Organization } from '../types/models';

const SCOPE_OPTIONS: ReadonlyArray<SegmentedOption<ExpenseScope>> = [
  { value: 'all', label: 'All', testID: 'expenses-scope-all' },
  { value: 'mine', label: 'Mine', testID: 'expenses-scope-mine' },
];

/** Room under the last row for the floating button. */
const LIST_BOTTOM_SPACE = layout.control.lg + spacing.lg * 2;

export default function ExpensesScreen() {
  const { user } = useAuth();
  const { activeOrg, isAdmin } = useOrg();
  if (!user || !activeOrg) {
    // The navigator only shows tabs with a session and an active organization.
    return <LoadingView />;
  }
  return <ExpensesContent userId={user.id} org={activeOrg} isAdmin={isAdmin} />;
}

interface ContentProps {
  userId: string;
  org: Organization;
  isAdmin: boolean;
}

function ExpensesContent({ userId, org, isAdmin }: ContentProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const currency = org.currency || CURRENCY;

  const { items, loading, refreshing, error, fromCache, cachedAt, refresh, revalidate } =
    useKharchaList(org.id);
  const { categories } = useCategories(org.id);

  const [scope, setScope] = useState<ExpenseScope>('all');
  const [filters, setFilters] = useState<ExpenseFilters>(DEFAULT_EXPENSE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => new Date());

  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [membersError, setMembersError] = useState<AppError | null>(null);
  const [shownOrgId, setShownOrgId] = useState(org.id);
  const membersSeq = useRef(0);

  // Switching organization starts from clean filters and search. This is a
  // state reset rather than a `key` on this component, because the header owns
  // the org switcher sheet: remounting would cut its close animation short.
  if (shownOrgId !== org.id) {
    setShownOrgId(org.id);
    setScope('all');
    setFilters(DEFAULT_EXPENSE_FILTERS);
    setFiltersOpen(false);
    setSearchOpen(false);
    setQuery('');
    setMembers(null);
    setMembersError(null);
    membersSeq.current += 1;
  }

  // Realtime keeps the list live; a quiet refetch on every return to the tab
  // also covers add/edit/delete round-trips and day labels after midnight.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setNow(new Date());
      revalidate();
    }, [revalidate]),
  );

  // Focus fires on navigation, never on a return to the foreground: without
  // this, "Today" and "This month" keep the date the tab was last entered on
  // while the rows underneath them refresh.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(new Date());
      }
    });
    return () => subscription.remove();
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
  }, []);

  // Android back closes the search field before leaving the tab.
  useFocusEffect(
    useCallback(() => {
      if (!searchOpen) {
        return undefined;
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        closeSearch();
        return true;
      });
      return () => subscription.remove();
    }, [searchOpen, closeSearch]),
  );

  const loadMembers = useCallback(async () => {
    const seq = ++membersSeq.current;
    setMembersError(null);
    try {
      const list = await listOrgMembers(org.id);
      if (seq === membersSeq.current) {
        setMembers(list);
      }
    } catch (err) {
      if (seq === membersSeq.current) {
        setMembersError(AppError.from(err));
      }
    }
  }, [org.id]);

  const openFilters = useCallback(() => {
    setFiltersOpen(true);
    if (isAdmin && members === null) {
      loadMembers();
    }
  }, [isAdmin, members, loadMembers]);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const openForm = useCallback(() => navigation.navigate('ExpenseForm'), [navigation]);
  const openDetail = useCallback(
    (kharchaId: string) => navigation.navigate('ExpenseDetail', { kharchaId }),
    [navigation],
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_EXPENSE_FILTERS);
    setQuery('');
  }, []);

  const summaryItems = useMemo(
    () => applyBaseFilters(items, { scope, userId, isAdmin, filters }),
    [items, scope, userId, isAdmin, filters],
  );
  const summary = useMemo(() => summarizeMonth(summaryItems, now), [summaryItems, now]);
  const visible = useMemo(
    () => applyPeriodAndSearch(summaryItems, { period: filters.period, search: query, userId, now }),
    [summaryItems, filters.period, query, userId, now],
  );
  const sections = useMemo(() => groupByDay(visible, now), [visible, now]);
  const typeOptions = useMemo(() => typeOptionsFor(categories, items), [categories, items]);
  const people = useMemo<PersonOption[] | null>(
    () =>
      members
        ?.filter(member => member.status !== 'pending')
        .map(member => ({
          id: member.user_id,
          name: member.user_id === userId ? 'You' : memberDisplayName(member.profile),
        })) ?? null,
    [members, userId],
  );

  const filterCount = activeFilterCount(filters);
  const firstLoad = loading && items.length === 0;
  // `fromCache` stays true after the network attempt only when it failed.
  const offline = fromCache && !loading && (!error || error.kind === 'network');
  const shownError = error && !offline ? error : null;

  const renderItem = useCallback(
    ({ item, index, section }: SectionListRenderItemInfo<KharchaWithOwner, ExpenseSection>) => (
      <ExpenseListItem
        item={item}
        userId={userId}
        currency={currency}
        onPress={openDetail}
        first={index === 0}
        last={index === section.data.length - 1}
      />
    ),
    [userId, currency, openDetail],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<KharchaWithOwner, ExpenseSection> }) => (
      <View style={styles.sectionHeader} accessibilityRole="header">
        <AppText variant="subhead" color="textSecondary" numberOfLines={1} style={styles.sectionTitle}>
          {section.title}
        </AppText>
        <AppText variant="subhead" color="textSecondary" tabular numberOfLines={1}>
          {formatAmount(section.total, currency)}
        </AppText>
      </View>
    ),
    [currency],
  );

  const header = (
    <AppHeader
      right={
        <IconButton
          icon={searchOpen ? 'x' : 'search'}
          accessibilityLabel={searchOpen ? 'Close search' : 'Search expenses'}
          onPress={searchOpen ? closeSearch : () => setSearchOpen(true)}
          testID="expenses-search-toggle"
        />
      }
    />
  );

  const savedAt = formatSavedAt(cachedAt, now);
  const listHeader = (
    <View style={styles.listHeader}>
      {offline ? (
        <Banner
          tone="neutral"
          icon="wifi-off"
          message={
            savedAt
              ? `You're offline. Showing expenses saved ${savedAt}.`
              : "You're offline. Showing saved expenses."
          }
          action={{ label: 'Try again', onPress: refresh }}
          testID="expenses-offline"
        />
      ) : null}
      {shownError ? (
        <ErrorBanner message={shownError.message} kind={shownError.kind} onRetry={refresh} />
      ) : null}

      <AppText variant="largeTitle" accessibilityRole="header">
        Expenses
      </AppText>

      <ExpenseSummaryCard
        summary={summary}
        currency={currency}
        loading={firstLoad}
        testID="expenses-summary"
      />

      <View style={styles.controls}>
        <Segmented
          options={SCOPE_OPTIONS}
          value={scope}
          onChange={setScope}
          style={styles.segmented}
          testID="expenses-scope"
        />
        <View>
          <IconButton
            icon="sliders-horizontal"
            variant="secondary"
            accessibilityLabel={
              filterCount > 0
                ? `Filters, ${filterCount} active`
                : 'Filters'
            }
            onPress={openFilters}
            testID="expenses-filters"
          />
          {filterCount > 0 ? <View style={styles.filterDot} pointerEvents="none" /> : null}
        </View>
      </View>
    </View>
  );

  let listEmpty: React.ReactElement | undefined;
  if (firstLoad) {
    listEmpty = <ExpenseListSkeleton />;
  } else if (items.length === 0) {
    listEmpty = shownError ? undefined : (
      <EmptyState
        icon="receipt"
        title="No expenses yet"
        message="Record your first expense to see it here."
        action={{ label: 'New expense', icon: 'plus', onPress: openForm, testID: 'expenses-empty-new' }}
        testID="expenses-empty"
      />
    );
  } else if (scope === 'mine' && filterCount === 0 && !query.trim()) {
    listEmpty = (
      <EmptyState
        icon="receipt"
        title="No expenses from you yet"
        message="Record an expense to see it here."
        action={{ label: 'New expense', icon: 'plus', onPress: openForm }}
        testID="expenses-empty-mine"
      />
    );
  } else {
    listEmpty = (
      <EmptyState
        icon="search"
        title="No matching expenses"
        message="Try another period, expense type or search."
        action={{ label: 'Reset filters', onPress: resetFilters, testID: 'expenses-reset-filters' }}
        testID="expenses-empty-filtered"
      />
    );
  }

  return (
    <View style={styles.root}>
      <Screen header={header} padded={false} gap={0} edges={['left', 'right']}>
        {searchOpen ? (
          <View style={styles.searchBar}>
            <TextField
              leftIcon="search"
              placeholder="Search by type, note or person"
              accessibilityLabel="Search expenses"
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              testID="expenses-search"
              right={
                query ? (
                  <IconButton
                    icon="x"
                    size="sm"
                    accessibilityLabel="Clear search"
                    onPress={() => setQuery('')}
                  />
                ) : null
              }
            />
          </View>
        ) : null}
        <SectionList
          sections={sections}
          keyExtractor={keyForItem}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          stickySectionHeadersEnabled
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={[
            styles.listContent,
            sections.length === 0 ? styles.listContentEmpty : null,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surface}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          testID="expenses-list"
        />
      </Screen>
      <Fab
        label="New expense"
        icon="plus"
        accessibilityLabel="New expense"
        onPress={openForm}
        testID="dashboard-fab"
        style={{ bottom: spacing.lg + (inTabs ? 0 : insets.bottom) }}
      />
      <FilterSheet
        visible={filtersOpen}
        onClose={closeFilters}
        value={filters}
        onApply={setFilters}
        typeOptions={typeOptions}
        showPeople={isAdmin}
        people={people}
        peopleError={membersError?.message ?? null}
        onRetryPeople={loadMembers}
      />
    </View>
  );
}

function keyForItem(item: KharchaWithOwner): string {
  return item.id;
}

function renderSectionFooter() {
  return <View style={styles.sectionFooter} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
  },
  listContent: { paddingBottom: LIST_BOTTOM_SPACE },
  listContentEmpty: { flexGrow: 1 },
  listHeader: {
    gap: spacing.lg,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segmented: { flex: 1 },
  filterDot: {
    position: 'absolute',
    top: spacing.xxs,
    right: spacing.xxs,
    width: spacing.sm + spacing.xxs,
    height: spacing.sm + spacing.xxs,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    borderWidth: spacing.xxs,
    borderColor: colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding + spacing.xs,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  sectionTitle: { flexShrink: 1 },
  sectionFooter: { height: spacing.sm },
});
