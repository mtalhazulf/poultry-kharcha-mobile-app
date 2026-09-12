import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, radius, shadow, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Default `segment-<value>`. */
  testID?: string;
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** 48 (md) or 32 (sm) tall; the track's own hitSlop carries the slop past its edge. Default 'md'. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Two to four mutually exclusive choices (All / Mine / Shared). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  style,
  testID,
}: SegmentedProps<T>) {
  const small = size === 'sm';
  return (
    <View
      accessibilityRole="tablist"
      // Android stops descending into a parent at its own bounds, so a
      // segment's hitSlop is only reachable if the track carries it too.
      hitSlop={small ? SLOP_SM : SLOP_MD}
      style={[styles.track, small ? styles.trackSm : styles.trackMd, style]}
      testID={testID}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            hitSlop={small ? SLOP_SM : SLOP_MD}
            onPress={() => {
              if (!selected) {
                onChange(option.value);
              }
            }}
            testID={option.testID ?? `segment-${option.value}`}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.selected : null,
              !selected && pressed ? styles.pressed : null,
              disabled ? styles.disabled : null,
            ]}
          >
            {option.icon ? (
              <Icon
                name={option.icon}
                size={layout.icon.sm}
                color={selected ? colors.text : colors.textSecondary}
              />
            ) : null}
            <AppText
              variant="subhead"
              color={selected ? 'text' : 'textSecondary'}
              numberOfLines={1}
              style={selected ? styles.labelSelected : null}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const SLOP_MD = { top: 4, bottom: 4 };
const SLOP_SM = { top: 8, bottom: 8 };

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: spacing.xxs,
    gap: spacing.xxs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  // 48 minus the track's padding and border leaves a 42dp segment; the 4dp of
  // hitSlop on each side then reaches the 48dp minimum target.
  trackMd: { height: layout.control.md },
  trackSm: { height: 32, borderRadius: radius.sm },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  selected: { backgroundColor: colors.surface, ...shadow.subtle },
  pressed: { backgroundColor: colors.border },
  disabled: { opacity: 0.5 },
  labelSelected: { fontWeight: '600' },
});
