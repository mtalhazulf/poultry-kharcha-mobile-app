import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Card, Money, Skeleton, type BadgeTone, type IconName } from '../../ui';
import { formatDateFriendly, spacing } from '../../theme';
import { describeDelta, type DeltaDirection, type MonthSummary } from './expenseListModel';
import { SpendSparkline } from './SpendSparkline';

export interface ExpenseSummaryCardProps {
  summary: MonthSummary;
  currency: string;
  /** First load with nothing cached: placeholders instead of zeros. */
  loading?: boolean;
  testID?: string;
}

// Spending more is worth a look; spending less is good news.
const DELTA_TONE: Record<DeltaDirection, BadgeTone> = {
  up: 'warning',
  down: 'success',
  flat: 'neutral',
};

const DELTA_ICON: Record<DeltaDirection, IconName | undefined> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: undefined,
};

export function ExpenseSummaryCard({ summary, currency, loading = false, testID }: ExpenseSummaryCardProps) {
  const delta = loading ? null : describeDelta(summary.delta);
  const countLabel = summary.count === 1 ? '1 expense' : `${summary.count} expenses`;
  const oldestDay = summary.daily[0]?.date ?? null;

  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.topRow}>
        <AppText variant="subhead" color="textSecondary">
          This month
        </AppText>
        {delta ? (
          <View accessible accessibilityLabel={delta.accessibilityLabel}>
            <Badge
              size="sm"
              tone={DELTA_TONE[summary.delta.direction]}
              icon={DELTA_ICON[summary.delta.direction]}
              label={delta.label}
            />
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.placeholder}>
          <Skeleton width="55%" height={spacing.xxxl} />
          <Skeleton width="25%" height={spacing.md} />
        </View>
      ) : (
        <View>
          <Money
            amount={summary.total}
            currency={currency}
            variant="amountLarge"
            numberOfLines={1}
            adjustsFontSizeToFit
            testID="expenses-month-total"
          />
          <AppText variant="caption" color="textSecondary">
            {countLabel}
          </AppText>
        </View>
      )}

      <View style={styles.chart}>
        <SpendSparkline days={summary.daily} currency={currency} />
        <View style={styles.axis}>
          {/* The window holds 30 days ending today, so the oldest bar is 29
              days back: name the day rather than mislabel the distance. */}
          <AppText variant="caption" color="textTertiary">
            {oldestDay ? formatDateFriendly(oldestDay) : ''}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            Today
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: spacing.xxl,
  },
  placeholder: { gap: spacing.sm, paddingVertical: spacing.xxs },
  chart: { gap: spacing.xs, marginTop: spacing.xs },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
