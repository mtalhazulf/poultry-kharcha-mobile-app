import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type Insets,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, layout, radius, spacing, type ColorToken, type TypographyVariant } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  /** primary (filled brand), secondary (outlined), tertiary (brand text),
   *  danger (filled red), ghost (neutral text). Default 'primary'. */
  variant?: ButtonVariant;
  /** 40 / 48 / 56 tall. Default 'md'. */
  size?: ButtonSize;
  /** Leading icon. */
  icon?: IconName;
  trailingIcon?: IconName;
  /** Shows a spinner, keeps the width, blocks presses. */
  loading?: boolean;
  /** Stretch to the parent's width (otherwise follows the parent's alignItems). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface VariantPalette {
  bg: string;
  pressedBg: string;
  border: string;
  fg: ColorToken;
}

const VARIANTS: Record<ButtonVariant, VariantPalette> = {
  primary: {
    bg: colors.primary,
    pressedBg: colors.primaryPressed,
    border: colors.primary,
    fg: 'textInverse',
  },
  secondary: {
    bg: colors.surface,
    pressedBg: colors.surfaceMuted,
    border: colors.borderStrong,
    fg: 'text',
  },
  tertiary: {
    bg: colors.transparent,
    pressedBg: colors.primarySubtle,
    border: colors.transparent,
    fg: 'primaryText',
  },
  danger: {
    bg: colors.danger,
    pressedBg: colors.dangerPressed,
    border: colors.danger,
    fg: 'textInverse',
  },
  ghost: {
    bg: colors.transparent,
    pressedBg: colors.surfaceMuted,
    border: colors.transparent,
    fg: 'textSecondary',
  },
};

const FILLED: ReadonlySet<ButtonVariant> = new Set(['primary', 'danger']);

const SIZES: Record<
  ButtonSize,
  { text: TypographyVariant; icon: number; gap: number; hitSlop?: Insets }
> = {
  sm: {
    text: 'subhead',
    icon: layout.icon.sm,
    gap: spacing.xs + spacing.xxs,
    hitSlop: { top: 4, bottom: 4 },
  },
  md: { text: 'bodyStrong', icon: layout.icon.md, gap: spacing.sm },
  lg: { text: 'headline', icon: layout.icon.md, gap: spacing.sm },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  loading = false,
  fullWidth = false,
  disabled,
  hitSlop,
  accessibilityLabel,
  style,
  ...rest
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const sizing = SIZES[size];
  const isDisabled = Boolean(disabled) || loading;
  const fg = colors[palette.fg];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={hitSlop ?? sizing.hitSlop}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        {
          backgroundColor: pressed ? palette.pressedBg : palette.bg,
          borderColor: pressed && FILLED.has(variant) ? palette.pressedBg : palette.border,
        },
        fullWidth ? styles.fullWidth : null,
        isDisabled && !loading ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      <View style={[styles.content, { gap: sizing.gap }, loading ? styles.invisible : null]}>
        {icon ? <Icon name={icon} size={sizing.icon} color={fg} /> : null}
        <AppText variant={sizing.text} color={palette.fg} numberOfLines={1} style={styles.label}>
          {title}
        </AppText>
        {trailingIcon ? <Icon name={trailingIcon} size={sizing.icon} color={fg} /> : null}
      </View>
      {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={fg} size="small" /> : null}
    </Pressable>
  );
}

const sizeStyles = StyleSheet.create({
  sm: { minHeight: layout.control.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  md: { minHeight: layout.control.md, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  lg: { minHeight: layout.control.lg, paddingHorizontal: spacing.xl, borderRadius: radius.md },
});

const styles = StyleSheet.create({
  base: {
    borderWidth: layout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600', flexShrink: 1 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
  invisible: { opacity: 0 },
});
