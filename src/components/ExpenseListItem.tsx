import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount, formatDate, formatDateFriendly, spacing, typography } from '../theme';
import { getCategoryMeta } from '../theme/categories';
import type { Kharcha } from '../types/models';
import { Badge, Card, IconCircle } from './ui';

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
  const meta = getCategoryMeta(item.category);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.category}, ${formatAmount(item.amount)}, ${formatDate(
        item.expense_date,
      )}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <IconCircle emoji={meta.emoji} bg={meta.bg} size={48} />

        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={styles.category} numberOfLines={1}>
              {item.category}
            </Text>
            {hasReceipt ? (
              <Text style={styles.receipt} accessibilityLabel="Has receipt">
                📎
              </Text>
            ) : null}
          </View>
          {item.note ? (
            <Text style={styles.note} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
          {showSharedWithYou ? <Badge icon="👥" label="Shared" tone="shared" /> : null}
          {showShared ? <Badge icon="👥" label="Shared" tone="mine" /> : null}
        </View>

        <View style={styles.right}>
          <Text style={styles.amount} numberOfLines={1}>
            {formatAmount(item.amount)}
          </Text>
          <Text style={styles.date}>{formatDateFriendly(item.expense_date)}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

export const ExpenseListItem = React.memo(ExpenseListItemComponent);

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingVertical: spacing.md,
  },
  main: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  category: { ...typography.bodyStrong, flexShrink: 1 },
  receipt: { fontSize: 16 },
  note: { ...typography.caption },
  right: { alignItems: 'flex-end', gap: spacing.xs, flexShrink: 0 },
  amount: { ...typography.amount, textAlign: 'right' },
  date: { ...typography.caption, textAlign: 'right' },
});
