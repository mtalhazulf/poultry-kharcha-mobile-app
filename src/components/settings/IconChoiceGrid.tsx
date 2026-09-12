import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { colors, layout, radius, spacing } from '../../theme';
import { CATEGORY_ICON_CHOICES, type CategoryIconName } from '../../theme/categories';
import { IconTile } from '../../ui';
import { iconChoiceLabel } from './settingsLogic';

export interface IconChoiceGridProps {
  value: CategoryIconName;
  onChange: (icon: CategoryIconName) => void;
  disabled?: boolean;
}

const CELL = layout.minTouch;
const GAP = spacing.sm;
const RING = spacing.xxs;

/** The 24 expense type icons as selectable tiles; the selected one gets a brand ring. */
export function IconChoiceGrid({ value, onChange, disabled = false }: IconChoiceGridProps) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth(prev => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);

  // Spread the cells evenly across the row once the width is known.
  const columns = width > 0 ? Math.max(4, Math.floor((width + GAP) / (CELL + GAP))) : 0;
  const cellWidth = columns > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : CELL;

  return (
    <View style={styles.grid} onLayout={onLayout} accessibilityRole="radiogroup">
      {CATEGORY_ICON_CHOICES.map(icon => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            accessibilityRole="radio"
            accessibilityLabel={iconChoiceLabel(icon)}
            accessibilityState={{ selected, checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(icon)}
            style={[styles.cell, { width: cellWidth }, disabled ? styles.disabled : null]}
            testID={`type-icon-${icon}`}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.ring,
                  selected ? styles.ringSelected : pressed ? styles.ringPressed : null,
                ]}
              >
                <IconTile icon={icon} tone={selected ? 'primary' : 'neutral'} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { height: CELL, alignItems: 'center', justifyContent: 'center' },
  ring: {
    padding: RING,
    borderWidth: RING,
    borderColor: colors.transparent,
    borderRadius: radius.md,
  },
  ringSelected: { borderColor: colors.primary },
  ringPressed: { borderColor: colors.borderStrong },
  disabled: { opacity: 0.5 },
});
