/**
 * Daily spend as plain Views: one bar per day, scaled to the busiest day,
 * with a guide at the top (labelled with that day's amount) and a baseline.
 * Today's bar keeps the full brand color while the other days are muted.
 * Screen readers get one summary sentence instead of 30 bars.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, formatAmountShort, layout, radius, spacing } from '../../theme';
import { AppText } from '../../ui';
import { buildChartBars, describeDailySpend, formatDayMonth } from './reportMath';

export interface DailySpendChartProps {
  /** Every day of the period, zeros included (`fillDailyTotals`). */
  days: ReadonlyArray<{ date: string; total: number }>;
  currency: string;
  /** "September 2026", used in the spoken summary. */
  period: string;
  /** `YYYY-MM-DD` of today when it falls inside the period. */
  today?: string | null;
  testID?: string;
}

const PLOT_HEIGHT = 120;
const MIN_BAR_HEIGHT = spacing.xs;

export function DailySpendChart({ days, currency, period, today = null, testID }: DailySpendChartProps) {
  const { bars, max } = useMemo(
    () => buildChartBars(days, { height: PLOT_HEIGHT, minHeight: MIN_BAR_HEIGHT, highlightDate: today }),
    [days, today],
  );
  const summary = useMemo(
    () => describeDailySpend(days, { period, currency, today }),
    [days, period, currency, today],
  );
  const focusToday = bars.some(bar => bar.highlighted);
  const first = bars[0];
  const middle = bars[Math.floor((bars.length - 1) / 2)];
  const last = bars[bars.length - 1];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} testID={testID}>
      <AppText variant="caption" color="textTertiary" tabular style={styles.maxLabel}>
        {formatAmountShort(max, currency)}
      </AppText>
      <View style={styles.guide} />
      <View style={[styles.plot, { gap: bars.length > 20 ? spacing.xxs : spacing.xs }]}>
        {bars.map(bar => (
          <View key={bar.date} style={styles.slot}>
            {bar.height > 0 ? (
              <View
                style={[
                  styles.bar,
                  { height: bar.height },
                  focusToday && !bar.highlighted ? styles.muted : null,
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.baseline} />
      {first && middle && last ? (
        <View style={styles.axis}>
          <AppText variant="caption" color="textSecondary">
            {formatDayMonth(first.date)}
          </AppText>
          {bars.length > 2 ? (
            <AppText variant="caption" color="textSecondary">
              {formatDayMonth(middle.date)}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textSecondary">
            {formatDayMonth(last.date)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  maxLabel: { marginBottom: spacing.xs },
  guide: { height: layout.hairline, backgroundColor: colors.border },
  plot: { height: PLOT_HEIGHT, flexDirection: 'row', alignItems: 'flex-end' },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.xs / 2,
    borderTopRightRadius: radius.xs / 2,
  },
  muted: { opacity: 0.4 },
  baseline: { height: layout.borderWidth, backgroundColor: colors.borderStrong },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs + spacing.xxs,
  },
});
