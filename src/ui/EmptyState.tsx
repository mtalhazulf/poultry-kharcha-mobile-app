import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
}

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  /** Primary button. */
  action?: EmptyStateAction;
  /** Quiet text button under the primary one. */
  secondaryAction?: EmptyStateAction;
  /** Grow to fill and center vertically (full-screen empty states). */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  secondaryAction,
  fill = false,
  style,
  testID,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, fill ? styles.fill : null, style]} testID={testID}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Icon name={icon} size={layout.icon.lg} color={colors.textSecondary} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="headline" align="center" accessibilityRole="header">
          {title}
        </AppText>
        {message ? (
          <AppText variant="callout" color="textSecondary" align="center">
            {message}
          </AppText>
        ) : null}
      </View>
      {action || secondaryAction ? (
        <View style={styles.actions}>
          {action ? (
            <Button
              title={action.label}
              icon={action.icon}
              onPress={action.onPress}
              testID={action.testID}
            />
          ) : null}
          {secondaryAction ? (
            <Button
              title={secondaryAction.label}
              icon={secondaryAction.icon}
              onPress={secondaryAction.onPress}
              testID={secondaryAction.testID}
              variant="tertiary"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.huge,
    gap: spacing.lg,
  },
  fill: { flex: 1, justifyContent: 'center' },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  text: { gap: spacing.xs + spacing.xxs, maxWidth: 320, alignItems: 'center' },
  actions: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
});
