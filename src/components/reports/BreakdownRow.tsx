import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, formatAmount, layout, radius, spacing } from '../../theme';
import { AppText, Money } from '../../ui';
import { formatShare, shareOf } from './reportMath';

export interface BreakdownRowProps {
  /** CategoryTile or Avatar. */
  leading: React.ReactNode;
  title: string;
  amount: number;
  /** Total of the period; drives the bar length and percentage. */
  total: number;
  count: number;
  currency: string;
  testID?: string;
}

const BAR_HEIGHT = spacing.xs + spacing.xxs;

/** One line of a breakdown: name and amount, then a proportion bar and its percentage. */
export function BreakdownRow({ leading, title, amount, total, count, currency, testID }: BreakdownRowProps) {
  const share = shareOf(amount, total);
  const shareText = formatShare(amount, total);
  const entries = count === 1 ? '1 entry' : `${count} entries`;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${title}, ${formatAmount(amount, currency)}, ${shareText} of total, ${entries}`}
      testID={testID}
    >
      {leading}
      <View style={styles.body}>
        <View style={styles.line}>
          <AppText variant="body" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          <Money amount={amount} currency={currency} numberOfLines={1} />
        </View>
        <View style={styles.line}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${share}%` }, share > 0 ? styles.fillVisible : null]} />
          </View>
          <AppText variant="caption" color="textSecondary" tabular align="right" style={styles.share}>
            {shareText}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  body: { flex: 1, gap: spacing.xs + spacing.xxs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  track: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  fillVisible: { minWidth: BAR_HEIGHT },
  share: { minWidth: layout.tile.md },
});
