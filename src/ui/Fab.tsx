import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, shadow, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface FabProps {
  onPress: () => void;
  /** Default 'Add'. Pass an empty string for an icon-only button. */
  label?: string;
  /** Default 'plus'. */
  icon?: IconName;
  accessibilityLabel?: string;
  testID?: string;
  /** Add the bottom safe-area inset (screens without a tab bar). Default false. */
  bottomInset?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Floating primary action, bottom right of its parent. */
export function Fab({
  onPress,
  label = 'Add',
  icon = 'plus',
  accessibilityLabel,
  testID,
  bottomInset = false,
  style,
}: FabProps) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (label || 'Add')}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.fab,
        label ? styles.extended : styles.round,
        { bottom: spacing.lg + (bottomInset ? insets.bottom : 0) },
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Icon name={icon} size={layout.icon.md} color={colors.textInverse} />
      {label ? (
        <AppText variant="bodyStrong" color="textInverse">
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    height: layout.control.lg,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    ...shadow.floating,
  },
  extended: { paddingLeft: spacing.lg, paddingRight: spacing.xl },
  round: { width: layout.control.lg },
  pressed: { backgroundColor: colors.primaryPressed },
});
