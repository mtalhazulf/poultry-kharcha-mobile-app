import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { TONES, type Tone } from './tones';

export type BadgeTone = Tone;

export interface BadgeProps {
  label: string;
  /** neutral / primary / success / warning / danger / info. Default 'neutral'. */
  tone?: BadgeTone;
  icon?: IconName;
  /** Small status dot before the label. */
  dot?: boolean;
  /** 20 or 24 tall. Default 'md'. */
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Badge({ label, tone = 'neutral', icon, dot = false, size = 'md', style, testID }: BadgeProps) {
  const palette = TONES[tone];
  return (
    <View
      style={[styles.badge, size === 'sm' ? styles.sm : styles.md, { backgroundColor: palette.bg }, style]}
      testID={testID}
      accessible
      accessibilityLabel={label}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: palette.icon }]} /> : null}
      {icon ? <Icon name={icon} size={12} color={palette.icon} /> : null}
      <AppText
        variant={size === 'sm' ? 'caption' : 'subhead'}
        color={palette.fgToken}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: 999,
  },
  sm: { minHeight: 20, paddingHorizontal: spacing.sm - spacing.xxs },
  md: { minHeight: 24, paddingHorizontal: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontWeight: '500' },
});
