import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { AppErrorKind } from '../lib/errors';
import { colors, layout, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { TONES } from './tones';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface BannerAction {
  label: string;
  onPress: () => void;
  testID?: string;
}

export interface BannerProps {
  /** Default 'info'. */
  tone?: BannerTone;
  title?: string;
  message?: string;
  /** Defaults per tone (info, circle-check, triangle-alert, circle-alert). */
  icon?: IconName;
  /** Text action under the message ("Try again"). */
  action?: BannerAction;
  /** Shows a close button. */
  onDismiss?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_ICONS: Record<BannerTone, IconName> = {
  info: 'info',
  success: 'circle-check',
  warning: 'triangle-alert',
  danger: 'circle-alert',
  neutral: 'info',
};

const ACTION_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

/** Inline message on a subtle tone background. */
export function Banner({
  tone = 'info',
  title,
  message,
  icon,
  action,
  onDismiss,
  children,
  style,
  testID,
}: BannerProps) {
  const palette = TONES[tone];
  const urgent = tone === 'danger' || tone === 'warning';
  return (
    <View
      accessibilityRole={urgent ? 'alert' : 'summary'}
      accessibilityLiveRegion={urgent ? 'polite' : 'none'}
      style={[styles.banner, { backgroundColor: palette.bg }, style]}
      testID={testID}
    >
      <Icon name={icon ?? DEFAULT_ICONS[tone]} size={layout.icon.md} color={palette.icon} style={styles.icon} />
      <View style={styles.body}>
        {title ? (
          <AppText variant="bodyStrong" color="text">
            {title}
          </AppText>
        ) : null}
        {message ? (
          <AppText variant="callout" color={title ? 'textSecondary' : 'text'}>
            {message}
          </AppText>
        ) : null}
        {children}
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            hitSlop={ACTION_HIT_SLOP}
            testID={action.testID}
            style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
          >
            <AppText variant="callout" color={palette.fgToken} style={styles.actionLabel}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <IconButton
          icon="x"
          size="sm"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          color={colors.textSecondary}
          style={styles.dismiss}
        />
      ) : null}
    </View>
  );
}

export interface ErrorBannerProps {
  /** Nothing renders without a message. */
  message?: string | null;
  /** AppError kind: 'network' shows an offline warning, the rest an error. */
  kind?: AppErrorKind;
  onRetry?: () => void;
  onDismiss?: () => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ErrorBanner({
  message,
  kind,
  onRetry,
  onDismiss,
  title,
  style,
  testID,
}: ErrorBannerProps) {
  if (!message) {
    return null;
  }
  const offline = kind === 'network';
  const icon: IconName = offline
    ? 'wifi-off'
    : kind === 'permission' || kind === 'auth'
    ? 'lock'
    : 'circle-alert';
  return (
    <Banner
      tone={offline ? 'warning' : 'danger'}
      icon={icon}
      title={title}
      message={message}
      action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
      onDismiss={onDismiss}
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: spacing.xxs },
  action: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    marginLeft: -spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
  },
  actionPressed: { opacity: 0.7 },
  actionLabel: { fontWeight: '600' },
  dismiss: { marginTop: -spacing.xs, marginRight: -spacing.xs },
});
