import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import {
  colors,
  CURRENCY,
  formatAmount,
  formatAmountFixed,
  typography,
  type ColorToken,
} from '../theme';
import { AppText } from './AppText';

export interface MoneyProps extends Omit<TextProps, 'children'> {
  amount: number;
  /** ISO code. Default 'PKR'. */
  currency?: string;
  /** 'amount' (15/22) for rows, 'amountLarge' (32/38) for headlines. */
  variant?: 'amount' | 'amountLarge';
  /** Always show cents ("PKR 18,250.00"); by default ".00" is hidden. */
  exact?: boolean;
  color?: ColorToken;
  align?: 'auto' | 'left' | 'center' | 'right';
}

const PARTS = /^(-?)(\S+) (.+)$/;

/** Formatted amount with tabular figures ("PKR 18,000"). */
export function Money({
  amount,
  currency = CURRENCY,
  variant = 'amount',
  exact = false,
  color = 'text',
  accessibilityLabel,
  ...rest
}: MoneyProps) {
  const text = exact ? formatAmountFixed(amount, currency) : formatAmount(amount, currency);
  const parts = variant === 'amountLarge' ? PARTS.exec(text) : null;

  if (parts) {
    const [, sign = '', code = '', figure = ''] = parts;
    // Quieter currency code so the number carries the headline.
    const codeColor = color === 'text' ? colors.textSecondary : colors[color];
    return (
      <AppText variant="amountLarge" color={color} accessibilityLabel={accessibilityLabel ?? text} {...rest}>
        {sign}
        <Text style={[styles.code, { color: codeColor }]}>{`${code} `}</Text>
        {figure}
      </AppText>
    );
  }

  return (
    <AppText variant={variant} color={color} accessibilityLabel={accessibilityLabel} {...rest}>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  // One size for the code everywhere a headline amount is drawn.
  code: { fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight },
});
