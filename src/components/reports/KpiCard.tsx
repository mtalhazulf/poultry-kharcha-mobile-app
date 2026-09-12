import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '../../theme';
import { AppText, Card } from '../../ui';

export interface KpiCardProps {
  label: string;
  /** The figure itself (Money or AppText). */
  children: React.ReactNode;
  /** Context under the figure: a delta badge, "per day", ... */
  footer?: React.ReactNode;
  /** Read as one sentence by screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function KpiCard({ label, children, footer, accessibilityLabel, style, testID }: KpiCardProps) {
  return (
    <Card
      style={[styles.card, style]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <AppText variant="subhead" color="textSecondary" numberOfLines={1}>
        {label}
      </AppText>
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Card>
  );
}

/**
 * KPI grid: the wide card takes a row of its own on phones; on wider screens
 * all three share one row.
 */
export const kpiLayout = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  wide: { flexGrow: 2, flexBasis: 240 },
  narrow: { flexGrow: 1, flexBasis: 140 },
});

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
