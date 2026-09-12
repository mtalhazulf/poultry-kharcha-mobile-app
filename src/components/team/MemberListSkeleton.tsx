import React from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, spacing } from '../../theme';
import { Card, Divider, LIST_TEXT_INSET, Skeleton } from '../../ui';

/** Placeholder rows shaped like MemberRow. */
export function MemberListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel="Loading people">
      <Skeleton width={96} height={12} style={styles.title} />
      <Card padded={false}>
        {Array.from({ length: rows }, (_, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <Divider inset={LIST_TEXT_INSET} /> : null}
            <View style={styles.row}>
              <Skeleton circle height={layout.tile.md} />
              <View style={styles.body}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="75%" height={12} />
              </View>
              <Skeleton width={56} height={20} radius={radius.full} />
            </View>
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { marginLeft: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  body: { flex: 1, gap: spacing.sm },
});
