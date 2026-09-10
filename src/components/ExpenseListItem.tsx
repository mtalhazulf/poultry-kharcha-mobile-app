import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, formatAmount, formatDate, radius, shadow, spacing, typography } from '../theme';
import type { Kharcha } from '../types/models';
import { Badge } from './ui';

export interface ExpenseListItemProps {
  item: Kharcha;
  /** Whether the signed-in user owns this expense (drives the share badges). */
  isOwner: boolean;
  onPress(): void;
}

function ExpenseListItemComponent({ item, isOwner, onPress }: ExpenseListItemProps) {
  const showSharedWithYou = !isOwner;
  const showShared = isOwner && item.visibility === 'shared';
  const hasReceipt = Boolean(item.receipt_path);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.category}, ${formatAmount(item.amount)}, ${formatDate(
        item.expense_date,
      )}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.category} numberOfLines={1}>
            {item.category}
          </Text>
          {showSharedWithYou ? <Badge label="Shared with you" tone="shared" /> : null}
          {showShared ? <Badge label="Shared" tone="mine" /> : null}
        </View>
        {item.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {item.note}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatDate(item.expense_date)}</Text>
          {hasReceipt ? (
            <Text style={styles.receipt} accessibilityLabel="Has receipt">
              📎 Receipt
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.amount} numberOfLines={1}>
        {formatAmount(item.amount)}
      </Text>
    </Pressable>
  );
}

export const ExpenseListItem = React.memo(ExpenseListItemComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardPressed: { opacity: 0.85 },
  main: { flex: 1, gap: spacing.xs },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  category: { ...typography.body, fontWeight: '600', flexShrink: 1 },
  note: { ...typography.caption, fontSize: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: { ...typography.caption },
  receipt: { ...typography.caption, color: colors.primary },
  amount: {
    ...typography.amount,
    fontSize: 18,
    textAlign: 'right',
    flexShrink: 0,
  },
});
