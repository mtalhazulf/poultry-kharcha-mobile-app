import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, touch } from '../theme';

export const FAB_SIZE = touch.fab;

export interface FabProps {
  onPress(): void;
  accessibilityLabel?: string;
}

/**
 * Extended "＋ Add" pill pinned to the bottom-right of its parent.
 *
 * The app draws edge to edge, so the screen continues under the phone's
 * navigation bar. The bottom inset lifts the button clear of it: a few dp for
 * the gesture handle, about 48dp when the phone uses the 3-button bar.
 */
export function Fab({ onPress, accessibilityLabel = 'Add expense' }: FabProps) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID="dashboard-fab"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.fab,
        { bottom: spacing.lg + insets.bottom },
        pressed && styles.fabPressed,
      ]}
    >
      <View style={styles.content} accessible={false}>
        <Text style={styles.plus}>＋</Text>
        <Text style={styles.label}>Add</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    height: FAB_SIZE,
    minWidth: FAB_SIZE,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
  fabPressed: { backgroundColor: colors.primaryDark },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  plus: {
    color: colors.textOnPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
    includeFontPadding: false,
  },
  label: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    includeFontPadding: false,
  },
});
