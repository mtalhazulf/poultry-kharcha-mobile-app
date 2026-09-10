import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, toIsoDate, typography } from '../theme';
import { CATEGORIES, type Kharcha } from '../types/models';
import { Chip } from './ui';

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

const OWNERSHIP_OPTIONS: ReadonlyArray<{
  value: OwnershipFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared with me' },
];

const DATE_OPTIONS: ReadonlyArray<{ value: DateFilter; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
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

export interface FilterBarProps {
  filters: Filters;
  onChange(next: Filters): void;
  /** Categories present in the data; merged with the built-in CATEGORIES. */
  categories: string[];
}

export function FilterBar({ filters, onChange, categories }: FilterBarProps) {
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(CATEGORIES);
    for (const category of categories) {
      if (category.trim()) {
        set.add(category);
      }
    }
    return [...set];
  }, [categories]);

  return (
    <View style={styles.container}>
      <FilterRow label="Show">
        {OWNERSHIP_OPTIONS.map(option => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filters.ownership === option.value}
            onPress={() => onChange({ ...filters, ownership: option.value })}
          />
        ))}
      </FilterRow>
      <FilterRow label="When">
        {DATE_OPTIONS.map(option => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filters.dateRange === option.value}
            onPress={() => onChange({ ...filters, dateRange: option.value })}
          />
        ))}
      </FilterRow>
      <FilterRow label="Category">
        <Chip
          label="All"
          selected={filters.category === null}
          onPress={() => onChange({ ...filters, category: null })}
        />
        {categoryOptions.map(category => (
          <Chip
            key={category}
            label={category}
            selected={filters.category === category}
            onPress={() => onChange({ ...filters, category })}
          />
        ))}
      </FilterRow>
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, backgroundColor: colors.background },
  row: { gap: spacing.xs },
  rowLabel: { ...typography.label, paddingHorizontal: spacing.lg },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
