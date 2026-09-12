import React from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, layout } from '../theme';
import { Icon, type IconName } from './Icon';

export type IconButtonVariant = 'ghost' | 'secondary' | 'tonal' | 'primary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  /** Required: icon-only buttons need a spoken name. */
  accessibilityLabel: string;
  /** Default 'ghost'. */
  variant?: IconButtonVariant;
  /** 32 / 40 / 48 visual; always at least 48dp to touch. Default 'md'. */
  size?: IconButtonSize;
  /** Overrides the icon color. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconButtonSize, { box: number; icon: number; slop: number }> = {
  sm: { box: layout.tile.sm, icon: layout.icon.sm, slop: 8 },
  md: { box: layout.tile.md, icon: layout.icon.md, slop: 4 },
  lg: { box: layout.tile.lg, icon: layout.icon.lg, slop: 0 },
};

const VARIANTS: Record<
  IconButtonVariant,
  { bg: string; pressedBg: string; border: string; fg: string }
> = {
  ghost: {
    bg: colors.transparent,
    pressedBg: colors.surfaceMuted,
    border: colors.transparent,
    fg: colors.textSecondary,
  },
  secondary: {
    bg: colors.surface,
    pressedBg: colors.surfaceMuted,
    border: colors.borderStrong,
    fg: colors.text,
  },
  tonal: {
    bg: colors.surfaceMuted,
    pressedBg: colors.border,
    border: colors.transparent,
    fg: colors.text,
  },
  primary: {
    bg: colors.primary,
    pressedBg: colors.primaryPressed,
    border: colors.transparent,
    fg: colors.textInverse,
  },
  danger: {
    bg: colors.transparent,
    pressedBg: colors.dangerSubtle,
    border: colors.transparent,
    fg: colors.danger,
  },
};

export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'ghost',
  size = 'md',
  color,
  disabled,
  hitSlop,
  style,
  ...rest
}: IconButtonProps) {
  const sizing = SIZES[size];
  const palette = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={hitSlop ?? sizing.slop}
      style={({ pressed }) => [
        styles.base,
        {
          width: sizing.box,
          height: sizing.box,
          backgroundColor: pressed ? palette.pressedBg : palette.bg,
          borderColor: palette.border,
        },
        disabled ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      <Icon name={icon} size={sizing.icon} color={color ?? palette.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: layout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
});
