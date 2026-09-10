import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCategories } from '../hooks/useCategories';
import { colors, radius, spacing, typography } from '../theme';
import { getCategoryMeta, type CategoryMeta } from '../theme/categories';
import { IconCircle } from './ui';

interface CategoryPickerProps {
  /** The stored `category` name; empty means "not chosen yet". */
  value: string;
  /** The stored `category_icon` — used to draw a value no longer in the org list. */
  icon: string | null;
  onChange(next: { name: string; icon: string }): void;
  error?: string | null;
}

const PER_ROW = 3;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function Tile({
  meta,
  selected,
  onPress,
}: {
  meta: CategoryMeta;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={`category-${meta.name}`}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.tileSelected,
        pressed && styles.tilePressed,
      ]}
    >
      <IconCircle emoji={meta.emoji} bg={meta.bg} size={40} />
      <Text
        style={[styles.tileLabel, selected && styles.tileLabelSelected]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {meta.name}
      </Text>
    </Pressable>
  );
}

/**
 * Grid of emoji tiles (three per row) built from the org's category list.
 * Tiles render immediately from the cache / built-in defaults, so there is
 * no spinner. A value that is no longer in the list (an old row, or a type an
 * admin renamed or retired) is shown as an extra selected tile using the icon
 * frozen on the row, so editing never silently loses the category.
 */
export function CategoryPicker({ value, icon, onChange, error }: CategoryPickerProps) {
  const { categories } = useCategories();

  const tiles = useMemo(() => {
    const active = categories.filter(c => c.active).map(c => getCategoryMeta(c.name, c.emoji));
    if (value !== '' && !active.some(t => t.name === value)) {
      active.push(getCategoryMeta(value, icon));
    }
    return active;
  }, [categories, value, icon]);

  const rows = useMemo(() => chunk(tiles, PER_ROW), [tiles]);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map(meta => (
              <Tile
                key={meta.name}
                meta={meta}
                selected={value === meta.name}
                onPress={() => onChange({ name: meta.name, icon: meta.emoji })}
              />
            ))}
            {row.length < PER_ROW
              ? Array.from({ length: PER_ROW - row.length }, (_, i) => (
                  <View key={`spacer-${i}`} style={styles.spacer} />
                ))
              : null}
          </View>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  grid: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tileSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tilePressed: { opacity: 0.85 },
  tileLabel: { ...typography.label, color: colors.text, textAlign: 'center' },
  tileLabelSelected: { color: colors.primary },
  spacer: { flex: 1 },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
