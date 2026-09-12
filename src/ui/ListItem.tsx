import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, formatAmount, layout, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { IconTile } from './IconTile';
import { Money } from './Money';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Any leading visual: <IconTile/>, <CategoryTile/>, <Avatar/>. */
  leading?: React.ReactNode;
  /** Shorthand for a neutral 40dp IconTile. */
  leadingIcon?: IconName;
  /** Secondary text on the right ("Admin", "English"). */
  value?: string;
  /** Right-aligned formatted amount with tabular figures. */
  amount?: number;
  currency?: string;
  /** Custom trailing node (Badge, Toggle, ...), before the chevron. */
  trailing?: React.ReactNode;
  /** Defaults to true for pressable, non-destructive rows. */
  chevron?: boolean;
  /** Picker rows: shows a check and sets accessibility selected. */
  selected?: boolean;
  /** Red title (and red tile for `leadingIcon`), no chevron. */
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  titleLines?: number;
  subtitleLines?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function ListItem({
  title,
  subtitle,
  leading,
  leadingIcon,
  value,
  amount,
  currency,
  trailing,
  chevron,
  selected,
  destructive = false,
  disabled = false,
  onPress,
  onLongPress,
  titleLines = 1,
  subtitleLines = 1,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ListItemProps) {
  const interactive = Boolean(onPress || onLongPress);
  const showChevron = chevron ?? (interactive && !destructive && selected === undefined);
  const leadingNode =
    leading ??
    (leadingIcon ? <IconTile icon={leadingIcon} tone={destructive ? 'danger' : 'neutral'} /> : null);
  const amountText = amount === undefined ? undefined : formatAmount(amount, currency);
  const label =
    accessibilityLabel ?? [title, subtitle, value, amountText].filter(Boolean).join(', ');

  const content = (
    <>
      {leadingNode}
      <View style={styles.body}>
        <AppText variant="body" color={destructive ? 'danger' : 'text'} numberOfLines={titleLines}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="callout" color="textSecondary" numberOfLines={subtitleLines}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="callout" color="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {amount !== undefined ? <Money amount={amount} currency={currency} style={styles.amount} /> : null}
      {trailing}
      {selected ? <Icon name="check" size={layout.icon.md} color={colors.primary} /> : null}
      {showChevron ? (
        <Icon name="chevron-right" size={layout.icon.md} color={colors.textTertiary} />
      ) : null}
    </>
  );

  if (!interactive) {
    return (
      <View
        style={[styles.row, disabled ? styles.disabled : null, style]}
        testID={testID}
        // Group for screen readers unless a trailing control needs its own focus.
        accessible={!trailing}
        accessibilityLabel={trailing ? undefined : label}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  body: { flex: 1, flexShrink: 1, gap: spacing.xxs },
  value: { flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
  amount: { flexShrink: 0 },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 },
});
