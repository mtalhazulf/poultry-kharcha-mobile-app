import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, typography, type ColorToken, type TypographyVariant } from '../theme';

export interface AppTextProps extends TextProps {
  /** Type scale token. Default 'body'. */
  variant?: TypographyVariant;
  /** Color token. Default 'text'. */
  color?: ColorToken;
  align?: 'auto' | 'left' | 'center' | 'right';
  /** Tabular figures, for numbers that should line up. */
  tabular?: boolean;
}

export function AppText({
  variant = 'body',
  color = 'text',
  align,
  tabular = false,
  maxFontSizeMultiplier = 1.4,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        styles.base,
        typography[variant],
        { color: colors[color] },
        align ? { textAlign: align } : null,
        tabular ? styles.tabular : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Exact line boxes on Android so rows line up with the 4-pt grid.
  base: { includeFontPadding: false },
  tabular: { fontVariant: ['tabular-nums'] },
});
