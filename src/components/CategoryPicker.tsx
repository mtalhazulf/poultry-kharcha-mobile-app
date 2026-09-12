import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCategories } from '../hooks/useCategories';
import { AppText, CategoryTile, ErrorBanner, Icon, IconTile, Sheet, Skeleton } from '../ui';
import { colors, layout, radius, spacing } from '../theme';

export interface CategoryPickerProps {
  orgId: string;
  /** Stored `category` name; empty means not chosen yet. */
  value: string;
  /** Stored `category_icon`, used to draw a type no longer in the active list. */
  icon: string | null;
  onChange: (next: { name: string; icon: string | null }) => void;
  error?: string | null;
  disabled?: boolean;
  /** Default "Expense type". */
  label?: string;
}

interface Option {
  name: string;
  icon: string | null;
}

const OPTION_HIT_SLOP = { top: 4, bottom: 4 };

function TypeOption({
  option,
  selected,
  disabled,
  onPress,
}: {
  option: Option;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.name}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={OPTION_HIT_SLOP}
      testID={`category-${option.name}`}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed && !selected ? styles.optionPressed : null,
        disabled ? styles.optionDisabled : null,
      ]}
    >
      <CategoryTile name={option.name} icon={option.icon} size="sm" />
      <AppText
        variant="callout"
        color={selected ? 'primaryText' : 'text'}
        numberOfLines={1}
        style={selected ? styles.labelSelected : null}
      >
        {option.name}
      </AppText>
      {selected ? <Icon name="check" size={layout.icon.sm} color={colors.primary} /> : null}
    </Pressable>
  );
}

/**
 * A compact selector row showing the chosen expense type; tapping it opens a
 * sheet with the organization's active types as a wrapping grid. A value that
 * is no longer active (an older expense, or a type an admin retired) is kept
 * as an extra option in that grid, with its frozen icon, so editing never
 * loses it.
 */
export function CategoryPicker({
  orgId,
  value,
  icon,
  onChange,
  error,
  disabled = false,
  label = 'Expense type',
}: CategoryPickerProps) {
  const { categories, loading, error: loadError, refresh } = useCategories(orgId);
  const [open, setOpen] = useState(false);

  const options = useMemo<Option[]>(() => {
    const list: Option[] = categories
      .filter(category => category.active)
      .map(category => ({ name: category.name, icon: category.icon }));
    if (value !== '' && !list.some(option => option.name === value)) {
      list.push({ name: value, icon });
    }
    return list;
  }, [categories, value, icon]);

  const select = (option: Option) => {
    onChange({ name: option.name, icon: option.icon });
    setOpen(false);
  };

  let sheetBody: React.ReactNode;
  if (options.length === 0 && loading) {
    sheetBody = (
      <View style={styles.grid} accessibilityLabel="Loading expense types">
        {[0, 1, 2, 3, 4, 5].map(index => (
          <Skeleton
            key={index}
            width={spacing.huge * 2}
            height={layout.control.sm}
            radius={radius.md}
          />
        ))}
      </View>
    );
  } else if (options.length === 0) {
    sheetBody = (
      <ErrorBanner
        message={loadError?.message ?? 'No expense types yet. Ask an admin to add one.'}
        kind={loadError?.kind}
        onRetry={refresh}
      />
    );
  } else {
    sheetBody = (
      <View style={styles.grid} accessibilityRole="radiogroup">
        {options.map(option => (
          <TypeOption
            key={option.name}
            option={option}
            selected={option.name === value}
            disabled={disabled}
            onPress={() => select(option)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="subhead" color="text">
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value || label}
        accessibilityHint={`Opens a list to choose the ${label.toLowerCase()}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        testID="category-picker-row"
        style={({ pressed }) => [
          styles.row,
          error ? styles.rowError : null,
          pressed ? styles.rowPressed : null,
          disabled ? styles.optionDisabled : null,
        ]}
      >
        {value ? (
          <CategoryTile name={value} icon={icon} size="sm" />
        ) : (
          <IconTile icon="package" tone="neutral" size="sm" />
        )}
        <AppText
          variant="callout"
          color={value ? 'text' : 'textSecondary'}
          numberOfLines={1}
          style={styles.rowLabel}
        >
          {value || `Select ${label.toLowerCase()}`}
        </AppText>
        <Icon name="chevron-right" size={layout.icon.sm} color={colors.textTertiary} />
      </Pressable>
      {error ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Icon name="circle-alert" size={layout.icon.sm} color={colors.danger} />
          <AppText variant="caption" color="dangerText" style={styles.messageText}>
            {error}
          </AppText>
        </View>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {sheetBody}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.control.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  rowError: { borderColor: colors.danger },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowLabel: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.control.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionDisabled: { opacity: 0.5 },
  labelSelected: { fontWeight: '600' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  messageText: { flex: 1 },
});
