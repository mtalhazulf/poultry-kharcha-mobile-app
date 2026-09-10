import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { CATEGORIES } from '../types/models';
import { Chip, TextField } from './ui';

interface CategoryPickerProps {
  /** The stored `category`: a preset name, or free text when "Other" is chosen. */
  value: string;
  onChange(value: string): void;
  error?: string | null;
}

const OTHER = 'Other';
const PRESETS: readonly string[] = CATEGORIES;

function isPreset(value: string): boolean {
  return PRESETS.includes(value);
}

/**
 * Wrapping row of category chips. Selecting "Other" reveals a text field; the
 * stored value becomes the custom text when provided, otherwise plain "Other".
 */
export function CategoryPicker({ value, onChange, error }: CategoryPickerProps) {
  const otherSelected = !isPreset(value) || value === OTHER;
  const customText = otherSelected && value !== OTHER ? value : '';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Category</Text>
      <View style={styles.row}>
        {CATEGORIES.map(name => {
          const selected = name === OTHER ? otherSelected : value === name;
          return (
            <Chip key={name} label={name} selected={selected} onPress={() => onChange(name)} />
          );
        })}
      </View>
      {otherSelected ? (
        <TextField
          label="Custom category"
          placeholder="e.g. Gifts"
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
  container: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  custom: { marginTop: spacing.md, marginBottom: 0 },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
