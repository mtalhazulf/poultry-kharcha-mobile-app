import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, formatAmount, radius, spacing } from '../../theme';
import { formatDayTitle } from './expenseListModel';

export interface SpendSparklineProps {
  /** Oldest first. */
  days: ReadonlyArray<{ date: string; total: number }>;
  currency: string;
  /** Default 40. */
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const MIN_BAR = spacing.xs - 1;
const EMPTY_BAR = spacing.xxs;

/** Compact daily bar chart built from Views. Days without spending show a flat tick. */
export function SpendSparkline({
  days,
  currency,
  height = spacing.huge - spacing.sm,
  style,
  testID,
}: SpendSparklineProps) {
  const { max, label } = useMemo(() => {
    let peak: { date: string; total: number } | null = null;
    for (const day of days) {
      if (day.total > 0 && (!peak || day.total > peak.total)) {
        peak = day;
      }
    }
    const spoken = peak
      ? `Daily spending, last ${days.length} days. Highest ${formatAmount(
          peak.total,
          currency,
        )} on ${formatDayTitle(peak.date)}.`
      : `No spending in the last ${days.length} days.`;
    return { max: peak?.total ?? 0, label: spoken };
  }, [days, currency]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.row, { height }, style]}
      testID={testID}
    >
      {days.map(day => {
        const hasSpend = day.total > 0 && max > 0;
        const barHeight = hasSpend
          ? Math.max(MIN_BAR, Math.round((day.total / max) * height))
          : EMPTY_BAR;
        return (
          <View
            key={day.date}
            style={[
              styles.bar,
              { height: barHeight },
              hasSpend ? styles.barSpend : styles.barEmpty,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs },
  bar: {
    flex: 1,
    borderTopLeftRadius: radius.xs / 2,
    borderTopRightRadius: radius.xs / 2,
  },
  barSpend: { backgroundColor: colors.primary },
  barEmpty: { backgroundColor: colors.border },
});
