import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout } from '../theme';

export interface DividerProps {
  /** Left inset in dp (e.g. to align with row titles). */
  inset?: number;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Divider({ inset = 0, vertical = false, style }: DividerProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        vertical ? styles.vertical : styles.horizontal,
        inset ? { marginLeft: inset } : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: { height: layout.hairline, alignSelf: 'stretch', backgroundColor: colors.border },
  vertical: { width: layout.hairline, alignSelf: 'stretch', backgroundColor: colors.border },
});
