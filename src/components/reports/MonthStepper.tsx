import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, radius, spacing } from '../../theme';
import { AppText, IconButton } from '../../ui';

export interface MonthStepperProps {
  /** "September 2026". */
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  /** False for the current month: reports never look into the future. */
  canGoNext: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Previous / next month control with the period in the middle. */
export function MonthStepper({ label, onPrevious, onNext, canGoNext, style }: MonthStepperProps) {
  return (
    <View style={[styles.row, style]}>
      <IconButton
        icon="chevron-left"
        accessibilityLabel="Previous month"
        onPress={onPrevious}
        testID="reports-previous-month"
      />
      <AppText
        variant="headline"
        align="center"
        numberOfLines={1}
        accessibilityLiveRegion="polite"
        style={styles.label}
        testID="reports-month"
      >
        {label}
      </AppText>
      <IconButton
        icon="chevron-right"
        accessibilityLabel="Next month"
        onPress={onNext}
        disabled={!canGoNext}
        testID="reports-next-month"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.control.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  label: { flex: 1, paddingHorizontal: spacing.sm },
});
