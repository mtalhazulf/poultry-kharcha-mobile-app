import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

export const FAB_SIZE = 56;

export interface FabProps {
  onPress(): void;
  accessibilityLabel?: string;
}

/** Floating "+" button pinned to the bottom-right of its parent. */
export function Fab({ onPress, accessibilityLabel = 'Add expense' }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID="dashboard-fab"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
    >
      <Text style={styles.plus} accessible={false}>
        +
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
  fabPressed: { backgroundColor: colors.primaryDark },
  plus: {
    color: colors.textOnPrimary,
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 34,
    includeFontPadding: false,
  },
});
