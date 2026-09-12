import React from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, spacing } from '../../theme';
import { Card, Divider, LIST_TEXT_INSET, Skeleton } from '../../ui';
import { kpiLayout } from './KpiCard';

/** Placeholder with the same shape as a loaded report. */
export function ReportSkeleton() {
  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel="Loading report">
      <View style={kpiLayout.row}>
        <Card style={[kpiLayout.wide, styles.kpi]}>
          <Skeleton width={88} height={12} />
          <Skeleton width="60%" height={32} />
          <Skeleton width={128} height={20} radius={radius.full} />
        </Card>
        <Card style={[kpiLayout.narrow, styles.kpi]}>
          <Skeleton width={64} height={12} />
          <Skeleton width="40%" height={24} />
        </Card>
        <Card style={[kpiLayout.narrow, styles.kpi]}>
          <Skeleton width={96} height={12} />
          <Skeleton width="70%" height={24} />
        </Card>
      </View>
      <Card style={styles.kpi}>
        <Skeleton width={72} height={12} />
        <Skeleton height={120} radius={radius.sm} />
      </Card>
      <Card padded={false}>
        {[0, 1, 2].map(index => (
          <React.Fragment key={index}>
            {index > 0 ? <Divider inset={LIST_TEXT_INSET} /> : null}
            <View style={styles.row}>
              <Skeleton width={layout.tile.md} height={layout.tile.md} radius={radius.sm} />
              <View style={styles.rowBody}>
                <Skeleton width="45%" height={14} />
                <Skeleton height={6} radius={radius.full} />
              </View>
            </View>
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxl },
  kpi: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBody: { flex: 1, gap: spacing.sm },
});
