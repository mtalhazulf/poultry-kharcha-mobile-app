import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Chip,
  ErrorBanner,
  SectionHeader,
  Sheet,
  Skeleton,
} from '../ui';
import { spacing } from '../theme';
import { iconForCategory } from '../theme/categories';
import {
  DEFAULT_EXPENSE_FILTERS,
  PERIOD_OPTIONS,
  type ExpenseFilters,
  type TypeOption,
} from './expenses/expenseListModel';

export interface PersonOption {
  id: string;
  name: string;
}

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Filters in effect; the sheet edits a draft and hands it back on Apply. */
  value: ExpenseFilters;
  onApply: (next: ExpenseFilters) => void;
  typeOptions: readonly TypeOption[];
  /** Admins only: shows the People section. */
  showPeople?: boolean;
  /** null while loading. */
  people?: readonly PersonOption[] | null;
  peopleError?: string | null;
  onRetryPeople?: () => void;
}

function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];
}

/** Period, expense types and (for admins) people. */
export function FilterSheet({
  visible,
  onClose,
  value,
  onApply,
  typeOptions,
  showPeople = false,
  people = null,
  peopleError = null,
  onRetryPeople,
}: FilterSheetProps) {
  const [draft, setDraft] = useState<ExpenseFilters>(value);
  const [prevVisible, setPrevVisible] = useState(visible);
  // Start from the applied filters every time the sheet opens.
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setDraft(value);
    }
  }

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      testID="filter-sheet"
      contentStyle={styles.body}
      footer={
        <View style={styles.footer}>
          <Button
            title="Reset"
            variant="secondary"
            onPress={() => setDraft(DEFAULT_EXPENSE_FILTERS)}
            style={styles.footerButton}
            testID="filter-reset"
          />
          <Button title="Apply" onPress={apply} style={styles.footerButton} testID="filter-apply" />
        </View>
      }
    >
      <View style={styles.section}>
        <SectionHeader title="Period" />
        <View style={styles.chips}>
          {PERIOD_OPTIONS.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.period === option.value}
              onPress={() => setDraft(prev => ({ ...prev, period: option.value }))}
              testID={`filter-period-${option.value}`}
            />
          ))}
        </View>
      </View>

      {typeOptions.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Expense types" />
          <View style={styles.chips}>
            {typeOptions.map(option => (
              <Chip
                key={option.name}
                label={option.name}
                icon={iconForCategory(option.name, option.icon)}
                selected={draft.categories.includes(option.name)}
                onPress={() =>
                  setDraft(prev => ({ ...prev, categories: toggle(prev.categories, option.name) }))
                }
                testID={`filter-type-${option.name}`}
              />
            ))}
          </View>
          {draft.categories.length === 0 ? (
            <AppText variant="caption" color="textSecondary" style={styles.hint}>
              No type selected shows every type.
            </AppText>
          ) : null}
        </View>
      ) : null}

      {showPeople ? (
        <View style={styles.section}>
          <SectionHeader title="People" />
          {peopleError ? (
            <ErrorBanner message={peopleError} onRetry={onRetryPeople} />
          ) : people === null ? (
            <View style={styles.chips}>
              {[0, 1, 2].map(index => (
                <Skeleton key={index} width={spacing.huge * 2} height={spacing.xxxl} radius={spacing.lg} />
              ))}
            </View>
          ) : (
            <View style={styles.chips}>
              {people.map(person => (
                <Chip
                  key={person.id}
                  label={person.name}
                  selected={draft.people.includes(person.id)}
                  onPress={() =>
                    setDraft(prev => ({ ...prev, people: toggle(prev.people, person.id) }))
                  }
                  testID={`filter-person-${person.id}`}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xxl },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, rowGap: spacing.md },
  hint: { paddingHorizontal: spacing.xs },
  footer: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { flex: 1 },
});
