/**
 * Shared primitives. Every control is at least 56dp tall, text is 18px, and
 * anything a user must recognise carries an icon — the audience may not read
 * fluently, so shape, colour and icon do the work that labels usually do.
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
import { colors, radius, spacing, touch, typography } from '../theme';
import type { AppErrorKind } from '../lib/errors';

// --- Button -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  /** Emoji or short glyph shown before the title. */
  icon?: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** `lg` is the single primary action of a screen. */
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  icon,
  variant = 'primary',
  loading = false,
  size = 'md',
  disabled,
  style,
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
        size === 'lg' && styles.buttonLg,
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
          {icon ? (
            <Text style={[styles.buttonIcon, size === 'lg' && styles.buttonIconLg]}>{icon}</Text>
          ) : null}
          <Text
            style={[styles.buttonText, size === 'lg' && styles.buttonTextLg, { color: textColor }]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// --- TextField --------------------------------------------------------------

interface TextFieldProps extends TextInputProps {
  label?: string;
  /** Emoji shown inside the field, left of the text. */
  icon?: string;
  error?: string | null;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  icon,
  error,
  hint,
  containerStyle,
  style,
  ...rest
}: TextFieldProps) {
  return (
    <View style={[styles.field, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        {icon ? <Text style={styles.inputIcon}>{icon}</Text> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// --- Segmented control ------------------------------------------------------

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

/** Two or three big mutually-exclusive choices, e.g. All / Mine / Shared. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]} accessibilityRole="tablist">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
            testID={`segment-${option.value}`}
          >
            <Text
              style={[styles.segmentText, selected && styles.segmentTextSelected]}
              numberOfLines={1}
            >
              {option.icon ? `${option.icon} ` : ''}
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Icon circle ------------------------------------------------------------

export function IconCircle({ emoji, bg, size = 48 }: { emoji: string; bg: string; size?: number }) {
  return (
    <View
      style={[
        styles.iconCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
      accessible={false}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
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
  const isNetwork = kind === 'network';
  const soft = isNetwork ? colors.warningSoft : colors.dangerSoft;
  const strong = isNetwork ? colors.warning : colors.danger;
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: soft }, style]}>
      <Text style={styles.bannerIcon}>{isNetwork ? '📶' : '⚠️'}</Text>
      <Text style={[styles.bannerText, { color: strong }]}>{message}</Text>
      <View style={styles.bannerActions}>
        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.bannerAction, { color: strong }]}>Retry</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.bannerAction, { color: strong }]}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function InfoBanner({
  message,
  icon,
  tone = 'info',
  style,
}: {
  message: string;
  icon?: string;
  tone?: 'info' | 'warning';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'warning' ? colors.warningSoft : colors.sharedSoft;
  const fg = tone === 'warning' ? colors.warning : colors.shared;
  return (
    <View style={[styles.banner, { backgroundColor: bg }, style]}>
      <Text style={styles.bannerIcon}>{icon ?? (tone === 'warning' ? '⚠️' : 'ℹ️')}</Text>
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
  emoji = '🗒️',
  title,
  message,
  action,
}: {
  emoji?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.centerText}>{message}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

// --- Bits -------------------------------------------------------------------

type BadgeTone = 'shared' | 'mine' | 'neutral' | 'danger';

export function Badge({
  label,
  icon,
  tone = 'neutral',
}: {
  label: string;
  icon?: string;
  tone?: BadgeTone;
}) {
  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    shared: { bg: colors.sharedSoft, fg: colors.shared },
    mine: { bg: colors.primarySoft, fg: colors.primary },
    neutral: { bg: colors.border, fg: colors.textMuted },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const p = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.badgeText, { color: p.fg }]}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
    </View>
  );
}

export function RoleBadge({ role }: { role: 'admin' | 'member' }) {
  return role === 'admin' ? (
    <Badge label="Admin" icon="🛡️" tone="mine" />
  ) : (
    <Badge label="Member" icon="👤" tone="neutral" />
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
  style,
  testID,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected, style]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
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
    minHeight: touch.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLg: { minHeight: 64, borderRadius: radius.lg },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonIcon: { fontSize: 20 },
  buttonIconLg: { fontSize: 24 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { ...typography.button },
  buttonTextLg: { fontSize: 20 },

  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.min,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  inputIcon: { fontSize: 22 },
  input: { flex: 1, minHeight: touch.min, color: colors.text, fontSize: 18, paddingVertical: 0 },
  inputError: { borderColor: colors.danger },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  fieldHint: { ...typography.caption, marginTop: spacing.xs },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: { backgroundColor: colors.surface, ...{ elevation: 1 } },
  segmentText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  segmentTextSelected: { color: colors.text },

  iconCircle: { alignItems: 'center', justifyContent: 'center' },

  banner: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerIcon: { fontSize: 18 },
  bannerText: { flex: 1, fontSize: 16, fontWeight: '500' },
  bannerActions: { flexDirection: 'row', gap: spacing.lg },
  bannerAction: { fontSize: 16, fontWeight: '700' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.sm },
  emptyTitle: { ...typography.heading, textAlign: 'center' },
  emptyAction: { marginTop: spacing.lg, alignSelf: 'stretch' },

  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 13, fontWeight: '700' },

  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 16, color: colors.text, fontWeight: '500' },
  chipTextSelected: { color: colors.textOnPrimary, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
