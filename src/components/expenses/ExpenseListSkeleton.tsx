import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, LIST_TEXT_INSET, Skeleton } from '../../ui';
import { colors, layout, radius, spacing } from '../../theme';

export interface ExpenseListSkeletonProps {
  /** Rows per day group. Default [3, 2]. */
  groups?: readonly number[];
}

const DEFAULT_GROUPS = [3, 2] as const;

/** Placeholder day groups shown while the first page of expenses loads. */
export function ExpenseListSkeleton({ groups = DEFAULT_GROUPS }: ExpenseListSkeletonProps) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading expenses"
      testID="expenses-loading"
    >
      {groups.map((rows, groupIndex) => (
        <View key={groupIndex} style={styles.group}>
          <View style={styles.header}>
            <Skeleton width="28%" height={spacing.md} />
            <Skeleton width="20%" height={spacing.md} />
          </View>
          <View style={styles.card}>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <View key={rowIndex}>
                {rowIndex > 0 ? <Divider inset={LIST_TEXT_INSET} /> : null}
                <View style={styles.row}>
                  <Skeleton width={layout.tile.md} height={layout.tile.md} radius={radius.sm} />
                  <View style={styles.lines}>
                    <Skeleton width="45%" height={spacing.md + spacing.xxs} />
                    <Skeleton width="70%" height={spacing.md} />
                  </View>
                  <Skeleton width={spacing.huge + spacing.lg} height={spacing.md + spacing.xxs} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  group: { paddingHorizontal: layout.screenPadding },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight + spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  lines: { flex: 1, gap: spacing.sm },
});
