/**
 * Settings-style lists: a white rounded group of big rows separated by thin
 * lines. Each row has a picture, a title, an optional hint, and a › when it
 * opens something. Used wherever a screen is "a list of things you can open".
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { IconCircle } from './ui';

const ICON_SIZE = 44;

export interface ListRowProps {
  icon: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  /** Extra content before the chevron, e.g. a badge. */
  right?: React.ReactNode;
  /** Makes the row tappable and shows a ›. */
  onPress?: () => void;
  tone?: 'default' | 'danger';
  dimmed?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function ListRow({
  icon,
  iconBg,
  title,
  subtitle,
  right,
  onPress,
  tone = 'default',
  dimmed = false,
  disabled = false,
  testID,
}: ListRowProps) {
  const danger = tone === 'danger';
  const content = (
    <>
      <IconCircle
        emoji={icon}
        bg={iconBg ?? (danger ? colors.dangerSoft : colors.primarySoft)}
        size={ICON_SIZE}
      />
      <View style={styles.body}>
        <Text style={[styles.title, danger && styles.titleDanger]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && !danger ? (
        <Text style={styles.chevron} accessible={false}>
          ›
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, dimmed && styles.dimmed]} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        dimmed && styles.dimmed,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Groups rows under an optional heading; renders nothing when it has no rows. */
export function ListGroup({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  /** Short hint under the group. */
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = React.Children.toArray(children);
  if (rows.length === 0) {
    return null;
  }
  return (
    <View style={[styles.groupWrap, style]}>
      {title ? (
        <Text style={styles.groupTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.group}>
        {rows.map((row, i) => (
          <View key={React.isValidElement(row) && row.key != null ? row.key : i}>
            {i > 0 ? <View style={styles.separator} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupWrap: { gap: spacing.sm },
  groupTitle: { ...typography.label, paddingHorizontal: spacing.xs },
  groupFooter: { ...typography.caption, paddingHorizontal: spacing.xs },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg + ICON_SIZE + spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong },
  titleDanger: { color: colors.danger },
  subtitle: { ...typography.caption },
  chevron: { fontSize: 30, lineHeight: 32, color: colors.textMuted, marginLeft: spacing.xs },
  dimmed: { opacity: 0.55 },
  pressed: { backgroundColor: colors.background },
  disabled: { opacity: 0.5 },
});
