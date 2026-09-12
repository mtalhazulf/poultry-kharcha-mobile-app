/**
 * The amount input of the expense form: currency code prefix and large
 * tabular figures. Same label, focus ring and error treatment as `TextField`,
 * which has no leading text slot. The ref is the underlying TextInput.
 */
import React, { forwardRef, useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { AppText, Icon, type TextFieldRef } from '../../ui';
import { colors, layout, radius, spacing, typography } from '../../theme';

export interface AmountFieldProps
  extends Omit<TextInputProps, 'style' | 'keyboardType' | 'inputMode' | 'placeholder'> {
  /** Default "Amount". */
  label?: string;
  /** ISO code shown before the number. */
  currency: string;
  error?: string | null;
  helperText?: string | null;
  disabled?: boolean;
}

const RING = 3;

type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export const AmountField = forwardRef<TextFieldRef, AmountFieldProps>(function AmountFieldBase(
  {
    label = 'Amount',
    currency,
    error,
    helperText,
    disabled = false,
    editable,
    accessibilityLabel,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const inputRef = useRef<TextFieldRef | null>(null);
  const [focused, setFocused] = useState(false);

  const setRefs = useCallback(
    (node: TextFieldRef | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  const handleFocus = useCallback<FocusHandler>(
    event => {
      setFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback<BlurHandler>(
    event => {
      setFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  const isEditable = !disabled && editable !== false;
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <AppText variant="subhead" color="text">
        {label}
      </AppText>
      <View
        style={[styles.ring, focused ? (hasError ? styles.ringError : styles.ringFocused) : null]}
      >
        <Pressable
          accessible={false}
          disabled={!isEditable}
          onPress={focusInput}
          style={[
            styles.field,
            focused ? styles.fieldFocused : null,
            hasError ? styles.fieldError : null,
            !isEditable ? styles.fieldDisabled : null,
          ]}
        >
          <AppText variant="title" color="textSecondary" style={styles.currency}>
            {currency}
          </AppText>
          <TextInput
            ref={setRefs}
            editable={isEditable}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.focusRing}
            cursorColor={colors.primary}
            selectionHandleColor={colors.primary}
            underlineColorAndroid="transparent"
            maxFontSizeMultiplier={1.2}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: !isEditable }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[styles.input, !isEditable ? styles.inputDisabled : null]}
            {...rest}
          />
        </Pressable>
      </View>
      {hasError ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Icon name="circle-alert" size={layout.icon.sm} color={colors.danger} />
          <AppText variant="caption" color="dangerText" style={styles.messageText}>
            {error}
          </AppText>
        </View>
      ) : helperText ? (
        <AppText variant="caption" color="textSecondary">
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs + spacing.xxs },
  ring: {
    margin: -RING,
    borderWidth: RING,
    borderColor: colors.transparent,
    borderRadius: radius.md + RING,
  },
  ringFocused: { borderColor: colors.focusRing },
  ringError: { borderColor: colors.dangerSubtle },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.control.lg + spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldFocused: { borderColor: colors.primary },
  fieldError: { borderColor: colors.danger },
  fieldDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  currency: { includeFontPadding: false },
  input: {
    ...typography.amountLarge,
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: colors.text,
    includeFontPadding: false,
  },
  inputDisabled: { color: colors.textSecondary },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  messageText: { flex: 1 },
});
