/**
 * Labelled text input. Chain fields with `returnKeyType="next"` +
 * `onSubmitEditing={() => nextRef.current?.focus()}` and
 * `submitBehavior="submit"`; the ref is the underlying TextInput.
 */
import React, { forwardRef, useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, layout, radius, spacing, typography } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Shown above the field and used as the accessibility label. */
  label?: string;
  /** Adds a quiet "Optional" next to the label. */
  optional?: boolean;
  helperText?: string;
  /** Replaces the helper text and turns the field red. */
  error?: string | null;
  leftIcon?: IconName;
  /** Trailing accessory inside the field (unit label, small button). */
  right?: React.ReactNode;
  /** Secure entry with a show/hide toggle. */
  password?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

const RING = 3;

/** Instance type of the forwarded ref: `const nextRef = useRef<TextFieldRef>(null)`. */
export type TextFieldRef = React.ComponentRef<typeof TextInput>;

export const TextField = forwardRef<TextFieldRef, TextFieldProps>(function TextFieldBase(
  {
    label,
    optional = false,
    helperText,
    error,
    leftIcon,
    right,
    password = false,
    disabled = false,
    editable,
    multiline,
    secureTextEntry,
    autoCapitalize,
    autoCorrect,
    accessibilityLabel,
    containerStyle,
    inputStyle,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const inputRef = useRef<TextFieldRef | null>(null);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

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
  const toggleReveal = useCallback(() => setRevealed(value => !value), []);

  const isEditable = !disabled && editable !== false;
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="subhead" color="text" numberOfLines={1} style={styles.label}>
            {label}
          </AppText>
          {optional ? (
            <AppText variant="caption" color="textTertiary">
              Optional
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.ring,
          focused ? (hasError ? styles.ringError : styles.ringFocused) : null,
        ]}
      >
        <Pressable
          accessible={false}
          disabled={!isEditable}
          onPress={focusInput}
          style={[
            styles.field,
            multiline ? styles.fieldMultiline : null,
            focused ? styles.fieldFocused : null,
            hasError ? styles.fieldError : null,
            !isEditable ? styles.fieldDisabled : null,
          ]}
        >
          {leftIcon ? (
            <Icon
              name={leftIcon}
              size={layout.icon.md}
              color={focused ? colors.textSecondary : colors.textTertiary}
              style={multiline ? styles.leftIconMultiline : null}
            />
          ) : null}
          <TextInput
            ref={setRefs}
            editable={isEditable}
            multiline={multiline}
            secureTextEntry={password ? !revealed : secureTextEntry}
            autoCapitalize={autoCapitalize ?? (password ? 'none' : undefined)}
            autoCorrect={autoCorrect ?? (password ? false : undefined)}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: !isEditable }}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.focusRing}
            cursorColor={colors.primary}
            selectionHandleColor={colors.primary}
            underlineColorAndroid="transparent"
            maxFontSizeMultiplier={1.4}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[
              styles.input,
              multiline ? styles.inputMultiline : null,
              !isEditable ? styles.inputDisabled : null,
              inputStyle,
            ]}
            {...rest}
          />
          {password ? (
            <IconButton
              icon={revealed ? 'eye-off' : 'eye'}
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              size="sm"
              onPress={toggleReveal}
              disabled={!isEditable}
            />
          ) : null}
          {right}
        </Pressable>
      </View>

      {hasError ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Icon name="circle-alert" size={14} color={colors.danger} style={styles.messageIcon} />
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
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  label: { flexShrink: 1 },
  // The ring sits outside the field so focus never shifts layout.
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
    gap: spacing.sm,
    minHeight: layout.control.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldMultiline: { alignItems: 'flex-start', minHeight: 96, paddingVertical: spacing.md },
  fieldFocused: { borderColor: colors.primary },
  fieldError: { borderColor: colors.danger },
  fieldDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  leftIconMultiline: { marginTop: 1 },
  input: {
    ...typography.body,
    flex: 1,
    alignSelf: 'stretch',
    minHeight: layout.control.md - 2 * layout.borderWidth,
    paddingVertical: 0,
    paddingHorizontal: 0,
    paddingRight: spacing.sm,
    color: colors.text,
    includeFontPadding: false,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  inputDisabled: { color: colors.textSecondary },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  messageIcon: { marginTop: 1 },
  messageText: { flex: 1 },
});
