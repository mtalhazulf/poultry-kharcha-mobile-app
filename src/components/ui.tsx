/**
 * Small set of shared primitives so every screen looks the same. Screens
 * compose these rather than styling raw RN views for buttons/inputs/errors.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import type { AppErrorKind } from '../lib/errors';

// --- Button -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  left?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  left,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor =
    variant === 'primary'
      ? colors.textOnPrimary
      : variant === 'danger'
      ? colors.danger
      : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        buttonVariants[variant],
        pressed && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonContent}>
          {left}
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// --- TextField --------------------------------------------------------------

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({ label, error, hint, containerStyle, style, ...rest }: TextFieldProps) {
  return (
    <View style={[styles.field, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// --- Feedback ---------------------------------------------------------------

interface ErrorBannerProps {
  message: string | null | undefined;
  kind?: AppErrorKind;
  onRetry?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorBanner({ message, kind, onRetry, onDismiss, style }: ErrorBannerProps) {
  if (!message) {
    return null;
  }
  const soft = kind === 'network' ? colors.warningSoft : colors.dangerSoft;
  const strong = kind === 'network' ? colors.warning : colors.danger;
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: soft }, style]}>
      <Text style={[styles.bannerText, { color: strong }]}>{message}</Text>
      <View style={styles.bannerActions}>
        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Text style={[styles.bannerAction, { color: strong }]}>Retry</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Text style={[styles.bannerAction, { color: strong }]}>Dismiss</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function InfoBanner({
  message,
  tone = 'info',
  style,
}: {
  message: string;
  tone?: 'info' | 'warning';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'warning' ? colors.warningSoft : colors.sharedSoft;
  const fg = tone === 'warning' ? colors.warning : colors.shared;
  return (
    <View style={[styles.banner, { backgroundColor: bg }, style]}>
      <Text style={[styles.bannerText, { color: fg }]}>{message}</Text>
    </View>
  );
}

export function LoadingView({ message }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.centerText}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.centerText}>{message}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

// --- Bits -------------------------------------------------------------------

type BadgeTone = 'shared' | 'mine' | 'neutral' | 'danger';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    shared: { bg: colors.sharedSoft, fg: colors.shared },
    mine: { bg: colors.primarySoft, fg: colors.primary },
    neutral: { bg: colors.border, fg: colors.textMuted },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const p = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.badgeText, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, style]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

// --- Styles -----------------------------------------------------------------

const buttonVariants = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft },
  danger: { backgroundColor: colors.dangerSoft },
  ghost: { backgroundColor: 'transparent' },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600' },

  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  fieldHint: { ...typography.caption, marginTop: spacing.xs },

  banner: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14 },
  bannerActions: { flexDirection: 'row', gap: spacing.md },
  bannerAction: { fontSize: 14, fontWeight: '600' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  emptyTitle: { ...typography.heading, textAlign: 'center' },
  emptyAction: { marginTop: spacing.md },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.textOnPrimary, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
