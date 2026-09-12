import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, CategoryTile, Divider, Icon, LIST_TEXT_INSET, Money } from '../ui';
import { colors, formatAmount, layout, radius, spacing } from '../theme';
import type { KharchaWithOwner } from '../types/models';
import { expenseSubtitle } from './expenses/expenseListModel';

export interface ExpenseListItemProps {
  item: KharchaWithOwner;
  /** Signed-in user, for "You". */
  userId: string;
  currency: string;
  onPress: (kharchaId: string) => void;
  /** First row of a day group: rounded top and no separator above. */
  first?: boolean;
  /** Last row of a day group: rounded bottom. */
  last?: boolean;
  testID?: string;
}

/**
 * One expense in the Expenses list. Rows of a day stack into a white group
 * with hairline separators inset after the icon.
 */
function ExpenseListItemBase({
  item,
  userId,
  currency,
  onPress,
  first = false,
  last = false,
  testID,
}: ExpenseListItemProps) {
  const { primary, secondary } = expenseSubtitle(item, userId);
  const hasReceipt = Boolean(item.receipt_path);
  const label = [
    item.category,
    formatAmount(item.amount, currency),
    primary,
    secondary,
    hasReceipt ? 'receipt attached' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.frame, first ? styles.frameFirst : null, last ? styles.frameLast : null]}>
      {first ? null : <Divider inset={LIST_TEXT_INSET} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the expense"
        onPress={() => onPress(item.id)}
        testID={testID}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      >
        <CategoryTile name={item.category} icon={item.category_icon} />
        <View style={styles.body}>
          <AppText variant="body" numberOfLines={1}>
            {item.category}
          </AppText>
          <View style={styles.subtitle}>
            <AppText
              variant="callout"
              color="textSecondary"
              numberOfLines={1}
              style={styles.subtitlePrimary}
            >
              {primary}
            </AppText>
            {secondary ? (
              <AppText
                variant="callout"
                color="textSecondary"
                numberOfLines={1}
                style={styles.subtitleSecondary}
              >
                {` · ${secondary}`}
              </AppText>
            ) : null}
          </View>
        </View>
        <View style={styles.trailing}>
          <Money amount={item.amount} currency={currency} numberOfLines={1} />
          {hasReceipt ? (
            <View style={styles.meta}>
              <Icon name="paperclip" size={layout.icon.sm} color={colors.textTertiary} />
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

export const ExpenseListItem = React.memo(ExpenseListItemBase);

const styles = StyleSheet.create({
  frame: {
    marginHorizontal: layout.screenPadding,
    backgroundColor: colors.surface,
    borderLeftWidth: layout.borderWidth,
    borderRightWidth: layout.borderWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  frameFirst: {
    borderTopWidth: layout.borderWidth,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  frameLast: {
    borderBottomWidth: layout.borderWidth,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight + spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  body: { flex: 1, gap: spacing.xxs },
  subtitle: { flexDirection: 'row', alignItems: 'center' },
  subtitlePrimary: { flexShrink: 1 },
  subtitleSecondary: { flexShrink: 0 },
  trailing: { alignItems: 'flex-end', gap: spacing.xxs, flexShrink: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
