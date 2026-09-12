import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Shows a small x (active filter chips). */
  onRemove?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const CHIP_HIT_SLOP = { top: 8, bottom: 8 };
const REMOVE_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 12 };

/** 32dp pill for filters and quick picks; 48dp touch target via hitSlop. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  onRemove,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: ChipProps) {
  const fg = selected ? colors.primaryText : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      hitSlop={CHIP_HIT_SLOP}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : null,
        pressed ? (selected ? styles.selectedPressed : styles.pressed) : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={layout.icon.sm} color={fg} /> : null}
      <AppText
        variant="subhead"
        color={selected ? 'primaryText' : 'text'}
        numberOfLines={1}
        style={selected ? styles.labelSelected : null}
      >
        {label}
      </AppText>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          onPress={onRemove}
          hitSlop={REMOVE_HIT_SLOP}
        >
          <Icon name="x" size={14} color={fg} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + spacing.xxs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primarySubtle, borderColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceMuted },
  selectedPressed: { borderColor: colors.primaryPressed },
  disabled: { opacity: 0.5 },
  labelSelected: { fontWeight: '600' },
});
