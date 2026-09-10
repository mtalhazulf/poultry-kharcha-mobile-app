import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORY_TILES, type CategoryMeta } from '../theme/categories';
import { CATEGORIES } from '../types/models';
import { IconCircle, TextField } from './ui';

interface CategoryPickerProps {
  /** The stored `category`: a preset name, or free text when "Other" is chosen. */
  value: string;
  onChange(value: string): void;
  error?: string | null;
}

const OTHER = 'Other';
const PRESETS: readonly string[] = CATEGORIES;
const PER_ROW = 3;

function isPreset(value: string): boolean {
  return PRESETS.includes(value);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

const ROWS = chunk(CATEGORY_TILES, PER_ROW);

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
 * Grid of emoji category tiles (three per row). Selecting "Other" reveals a
 * text field; the stored value becomes the custom text when provided,
 * otherwise plain "Other".
 */
export function CategoryPicker({ value, onChange, error }: CategoryPickerProps) {
  const otherSelected = !isPreset(value) || value === OTHER;
  const customText = otherSelected && value !== OTHER ? value : '';

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map(meta => (
              <Tile
                key={meta.name}
                meta={meta}
                selected={meta.name === OTHER ? otherSelected : value === meta.name}
                onPress={() => onChange(meta.name)}
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
      {otherSelected ? (
        <TextField
          icon="✏️"
          placeholder="Type a name, e.g. Gifts"
          value={customText}
          onChangeText={text => onChange(text.length > 0 ? text : OTHER)}
          autoCapitalize="words"
          maxLength={40}
          containerStyle={styles.custom}
        />
      ) : null}
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
  custom: { marginTop: spacing.md, marginBottom: 0 },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
