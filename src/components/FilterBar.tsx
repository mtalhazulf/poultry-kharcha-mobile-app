import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, toIsoDate, typography } from '../theme';
import { getCategoryMeta } from '../theme/categories';
import { CATEGORIES, type Kharcha } from '../types/models';
import { Button, Chip, Segmented, type SegmentOption } from './ui';

export type OwnershipFilter = 'all' | 'mine' | 'shared';
export type DateFilter = 'this_month' | 'last_month' | 'last_30' | 'all';

export interface Filters {
  ownership: OwnershipFilter;
  dateRange: DateFilter;
  /** Exact category match, or null for every category. */
  category: string | null;
}

export const DEFAULT_FILTERS: Filters = {
  ownership: 'all',
  dateRange: 'this_month',
  category: null,
};

const OWNERSHIP_OPTIONS: ReadonlyArray<SegmentOption<OwnershipFilter>> = [
  { value: 'all', label: 'All', icon: '🗂️' },
  { value: 'mine', label: 'Mine', icon: '👤' },
  { value: 'shared', label: 'Shared', icon: '👥' },
];

const DATE_OPTIONS: ReadonlyArray<{ value: DateFilter; label: string; icon: string }> = [
  { value: 'this_month', label: 'This month', icon: '📅' },
  { value: 'last_month', label: 'Last month', icon: '⏮️' },
  { value: 'last_30', label: 'Last 30 days', icon: '🗓️' },
  { value: 'all', label: 'All time', icon: '♾️' },
];

/**
 * Inclusive YYYY-MM-DD bounds for a date filter, in local time (matching what
 * `expense_date` stores). Returns null for 'all'.
 */
export function getDateRange(filter: DateFilter, now: Date): { from: string; to: string } | null {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (filter) {
    case 'this_month': {
      return {
        from: toIsoDate(new Date(year, month, 1)),
        // Day 0 of the next month is the last day of this month.
        to: toIsoDate(new Date(year, month + 1, 0)),
      };
    }
    case 'last_month': {
      return {
        from: toIsoDate(new Date(year, month - 1, 1)),
        to: toIsoDate(new Date(year, month, 0)),
      };
    }
    case 'last_30': {
      const from = new Date(year, month, now.getDate() - 29);
      return { from: toIsoDate(from), to: toIsoDate(now) };
    }
    case 'all':
      return null;
  }
}

/** Pure filter used by the dashboard; `now` is injectable for tests. */
export function applyFilters(
  items: Kharcha[],
  filters: Filters,
  userId: string,
  now: Date = new Date(),
): Kharcha[] {
  const range = getDateRange(filters.dateRange, now);
  return items.filter(item => {
    if (filters.ownership === 'mine' && item.owner_id !== userId) {
      return false;
    }
    if (filters.ownership === 'shared' && item.owner_id === userId) {
      return false;
    }
    if (filters.category !== null && item.category !== filters.category) {
      return false;
    }
    if (range && (item.expense_date < range.from || item.expense_date > range.to)) {
      return false;
    }
    return true;
  });
}

/**
 * How many "advanced" filters (the ones behind the ⚙️ button) are away from
 * their defaults. Ownership is always visible, so it does not count.
 */
export function activeFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.dateRange !== DEFAULT_FILTERS.dateRange) {
    count += 1;
  }
  if (filters.category !== null) {
    count += 1;
  }
  return count;
}

// --- OwnershipToggle --------------------------------------------------------

export interface OwnershipToggleProps {
  value: OwnershipFilter;
  onChange(next: OwnershipFilter): void;
}

/** All / Mine / Shared — always on screen, one tap each. */
export function OwnershipToggle({ value, onChange }: OwnershipToggleProps) {
  return <Segmented options={OWNERSHIP_OPTIONS} value={value} onChange={onChange} />;
}

// --- FilterSheet ------------------------------------------------------------

export interface FilterSheetProps {
  visible: boolean;
  filters: Filters;
  /** Categories present in the data; merged with the built-in CATEGORIES. */
  categories: string[];
  onChange(next: Filters): void;
  onClose(): void;
}

/** Bottom sheet with the date range and category filters. */
export function FilterSheet({ visible, filters, categories, onChange, onClose }: FilterSheetProps) {
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(CATEGORIES);
    for (const category of categories) {
      if (category.trim()) {
        set.add(category);
      }
    }
    return [...set];
  }, [categories]);

  const clear = () =>
    onChange({
      ...filters,
      dateRange: DEFAULT_FILTERS.dateRange,
      category: DEFAULT_FILTERS.category,
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close filters"
        />
        <View style={styles.sheet} testID="filter-sheet">
          <View style={styles.handle} accessible={false} />
          <Text style={styles.sheetTitle} accessibilityRole="header">
            ⚙️ Filters
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionLabel}>When</Text>
            <View style={styles.chips}>
              {DATE_OPTIONS.map(option => (
                <Chip
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  selected={filters.dateRange === option.value}
                  onPress={() => onChange({ ...filters, dateRange: option.value })}
                  testID={`filter-date-${option.value}`}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.chips}>
              <Chip
                icon="🗂️"
                label="All"
                selected={filters.category === null}
                onPress={() => onChange({ ...filters, category: null })}
                testID="filter-category-all"
              />
              {categoryOptions.map(category => (
                <Chip
                  key={category}
                  icon={getCategoryMeta(category).emoji}
                  label={category}
                  selected={filters.category === category}
                  onPress={() => onChange({ ...filters, category })}
                  testID={`filter-category-${category}`}
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button size="lg" icon="✅" title="Done" onPress={onClose} testID="filter-done" />
            <Button
              variant="ghost"
              icon="🧹"
              title="Clear filters"
              onPress={clear}
              disabled={activeFilterCount(filters) === 0}
              testID="filter-clear"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: colors.text, opacity: 0.45 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    ...shadow.fab,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.heading, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
});
