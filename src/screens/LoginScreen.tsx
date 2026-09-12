import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { GoogleMark } from '../components/GoogleMark';
import { useAuth } from '../context/AuthProvider';
import { validateEmail } from '../lib/auth';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, layout, radius, spacing, typography } from '../theme';
import { AppText, Button, Divider, ErrorBanner, Screen, TextField, type TextFieldRef } from '../ui';

type Props = RootStackScreenProps<'Login'>;

/**
 * Keeps the button under the last field visible above the keyboard, not just
 * the field: the button itself (48), the gap above and below it (16 each) and
 * one caption line (16) for the helper or error text that the sign-up screen's
 * password field carries.
 */
export const AUTH_KEYBOARD_OFFSET =
  layout.control.md + spacing.lg * 2 + typography.caption.lineHeight;

/** Brand lockup shared by the sign-in and sign-up screens. */
export function AuthBrand() {
  return (
    <View style={brandStyles.row} accessible accessibilityLabel="MPS Expense Tracker">
      <View style={brandStyles.mark}>
        <AppText
          variant="caption"
          color="textInverse"
          maxFontSizeMultiplier={1}
          style={brandStyles.markText}
        >
          MPS
        </AppText>
      </View>
      <AppText variant="headline">MPS Expense Tracker</AppText>
    </View>
  );
}

/** Supabase Auth sentences that read better rewritten; anything else is shown as-is. */
function signInMessage(error: AppError): string {
  if (/invalid login credentials/i.test(error.message)) {
    return 'Incorrect email or password.';
  }
  if (/email not confirmed/i.test(error.message)) {
    return 'Confirm your email first. Open the link we sent to your inbox.';
  }
  return error.message;
}

interface GoogleButtonProps {
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}

/** Secondary button with the Google mark (Button only takes lucide icons). */
function GoogleButton({ onPress, loading, disabled }: GoogleButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      testID="login-google"
      style={({ pressed }) => [
        styles.google,
        pressed ? styles.googlePressed : null,
        disabled && !loading ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textSecondary} />
      ) : (
        <>
          <GoogleMark />
          <AppText variant="bodyStrong" numberOfLines={1}>
            Continue with Google
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export default function LoginScreen({ navigation }: Props) {
  const { signInWithPassword, signInWithGoogle, lastAuthError, clearAuthError } = useAuth();
  const passwordRef = useRef<TextFieldRef>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const busy = submitting || googleBusy;
  const shownError = error ?? lastAuthError;

  const dismissError = useCallback(() => {
    setError(null);
    clearAuthError();
  }, [clearAuthError]);

  const onEmailChange = useCallback((text: string) => {
    setEmail(text);
    setEmailError(null);
  }, []);

  const onPasswordChange = useCallback((text: string) => {
    setPassword(text);
    setPasswordError(null);
  }, []);

  const focusPassword = useCallback(() => passwordRef.current?.focus(), []);

  const onSubmit = useCallback(async () => {
    if (busy) {
      return;
    }
    const nextEmailError = validateEmail(email);
    // Sign-in only checks presence; length rules belong to sign-up.
    const nextPasswordError = password ? null : 'Enter your password.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      return;
    }
    dismissError();
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      // Success: the auth state change moves the navigator past this screen.
    } catch (err) {
      setError(AppError.from(err));
    } finally {
      setSubmitting(false);
    }
  }, [busy, email, password, signInWithPassword, dismissError]);

  const onGoogle = useCallback(async () => {
    if (busy) {
      return;
    }
    dismissError();
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(AppError.from(err));
    } finally {
      setGoogleBusy(false);
    }
  }, [busy, signInWithGoogle, dismissError]);

  const goToSignUp = useCallback(() => {
    dismissError();
    navigation.navigate('SignUp');
  }, [dismissError, navigation]);

  return (
    <Screen
      keyboard
      background="surface"
      gap={spacing.xxl}
      keyboardOffset={AUTH_KEYBOARD_OFFSET}
      contentStyle={styles.content}
      testID="login-screen"
    >
      <AuthBrand />

      <View style={styles.heading}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Sign in
        </AppText>
        <AppText variant="body" color="textSecondary">
          Welcome back. Enter your details to continue.
        </AppText>
      </View>

      <ErrorBanner
        message={shownError ? signInMessage(shownError) : null}
        kind={shownError?.kind}
        onDismiss={dismissError}
        testID="login-error"
      />

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={onEmailChange}
          error={emailError}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={focusPassword}
          testID="login-email"
        />
        <TextField
          ref={passwordRef}
          label="Password"
          password
          value={password}
          onChangeText={onPasswordChange}
          error={passwordError}
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          testID="login-password"
        />
        <Button
          title="Sign in"
          onPress={onSubmit}
          loading={submitting}
          disabled={googleBusy}
          fullWidth
          testID="login-submit"
        />
      </View>

      <View style={styles.alternative}>
        <View style={styles.orRow}>
          <Divider style={styles.orLine} />
          <AppText variant="caption" color="textSecondary">
            or
          </AppText>
          <Divider style={styles.orLine} />
        </View>
        <GoogleButton onPress={onGoogle} loading={googleBusy} disabled={submitting} />
      </View>

      <View style={styles.footer}>
        <AppText variant="callout" color="textSecondary">
          New to MPS?
        </AppText>
        <Button
          title="Create account"
          variant="tertiary"
          size="sm"
          onPress={goToSignUp}
          disabled={busy}
          testID="login-create-account"
        />
      </View>
    </Screen>
  );
}

const brandStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: {
    width: layout.tile.md,
    height: layout.tile.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontWeight: '700', letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xxxl },
  heading: { gap: spacing.sm },
  form: { gap: spacing.lg },
  alternative: { gap: spacing.xxl },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  orLine: { flex: 1 },
  google: {
    minHeight: layout.control.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  googlePressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.45 },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
