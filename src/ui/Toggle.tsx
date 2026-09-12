import React from 'react';
import { Switch, type SwitchProps } from 'react-native';
import { colors } from '../theme';

export interface ToggleProps
  extends Omit<SwitchProps, 'value' | 'onValueChange' | 'trackColor' | 'thumbColor' | 'ios_backgroundColor'> {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const TRACK = { false: colors.borderStrong, true: colors.primary };

/** Platform switch in brand colors. Pair with a ListItem `trailing`. */
export function Toggle({ value, onValueChange, disabled, ...rest }: ToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={TRACK}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.borderStrong}
      {...rest}
    />
  );
}
