import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, layout, radius, spacing } from '../theme';

export interface CardProps extends Omit<ViewProps, 'style'> {
  children?: React.ReactNode;
  /** 16dp inner padding. Default true. */
  padded?: boolean;
  /** Makes the whole card tappable (pressed = muted background). */
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** White surface with a hairline outline; no shadow. */
export function Card({
  children,
  padded = true,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  testID,
  ...rest
}: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        style={({ pressed }) => [
          styles.card,
          padded ? styles.padded : null,
          pressed ? styles.pressed : null,
          disabled ? styles.disabled : null,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View
      style={[styles.card, padded ? styles.padded : null, style]}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 },
});
