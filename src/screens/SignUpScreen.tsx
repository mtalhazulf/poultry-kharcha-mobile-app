import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthProvider';
import { MIN_PASSWORD_LENGTH, validateEmail, validatePassword } from '../lib/auth';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { spacing } from '../theme';
import {
  AppText,
  Button,
  ErrorBanner,
  IconTile,
  Screen,
  TextField,
  type TextFieldRef,
} from '../ui';
import { AUTH_KEYBOARD_OFFSET, AuthBrand } from './LoginScreen';

type Props = RootStackScreenProps<'SignUp'>;

interface FieldErrors {
  name: string | null;
  email: string | null;
  password: string | null;
}

const NO_ERRORS: FieldErrors = { name: null, email: null, password: null };

/** Supabase Auth sentences that read better rewritten; anything else is shown as-is. */
function signUpMessage(error: AppError): string {
  if (/already registered|already exists/i.test(error.message)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  return error.message;
}

export default function SignUpScreen({ navigation }: Props) {
  const { signUpWithPassword } = useAuth();
  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  /** Set when the account needs email confirmation before the first sign-in. */
  const [sentTo, setSentTo] = useState<string | null>(null);

  const clearFieldError = useCallback((key: keyof FieldErrors) => {
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: null } : prev));
  }, []);

  const onNameChange = useCallback(
    (text: string) => {
      setName(text);
      clearFieldError('name');
    },
    [clearFieldError],
  );

  const onEmailChange = useCallback(
    (text: string) => {
      setEmail(text);
      clearFieldError('email');
    },
    [clearFieldError],
  );

  const onPasswordChange = useCallback(
    (text: string) => {
      setPassword(text);
      clearFieldError('password');
    },
    [clearFieldError],
  );

  const focusEmail = useCallback(() => emailRef.current?.focus(), []);
  const focusPassword = useCallback(() => passwordRef.current?.focus(), []);

  const onSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    const next: FieldErrors = {
      name: name.trim() ? null : 'Enter your full name.',
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(next);
    if (next.name || next.email || next.password) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(email, password, name.trim());
      if (needsEmailConfirmation) {
        setSentTo(email.trim());
      }
      // Otherwise a session exists and the navigator moves on by itself.
    } catch (err) {
      setError(AppError.from(err));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, name, email, password, signUpWithPassword]);

  const goToLogin = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Login');
    }
  }, [navigation]);

  if (sentTo !== null) {
    return (
      <Screen
        background="surface"
        gap={spacing.xxl}
        contentStyle={styles.confirm}
        footer={
          <Button
            title="Back to sign in"
            onPress={goToLogin}
            fullWidth
            testID="signup-back-to-login"
          />
        }
        testID="signup-check-inbox"
      >
        <IconTile icon="mail" tone="primary" size="lg" />
        <View style={styles.confirmText}>
          <AppText variant="title" align="center" accessibilityRole="header">
            Check your inbox
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            We sent a confirmation link to {sentTo}. Open it on this phone to finish creating your
            account.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      background="surface"
      gap={spacing.xxl}
      keyboardOffset={AUTH_KEYBOARD_OFFSET}
      contentStyle={styles.content}
      testID="signup-screen"
    >
      <AuthBrand />

      <View style={styles.heading}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Create account
        </AppText>
        <AppText variant="body" color="textSecondary">
          Enter your details to get started.
        </AppText>
      </View>

      <ErrorBanner
        message={error ? signUpMessage(error) : null}
        kind={error?.kind}
        onDismiss={() => setError(null)}
        testID="signup-error"
      />

      <View style={styles.form}>
        <TextField
          label="Full name"
          value={name}
          onChangeText={onNameChange}
          error={fieldErrors.name}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={focusEmail}
          testID="signup-name"
        />
        <TextField
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={onEmailChange}
          error={fieldErrors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={focusPassword}
          testID="signup-email"
        />
        <TextField
          ref={passwordRef}
          label="Password"
          password
          value={password}
          onChangeText={onPasswordChange}
          error={fieldErrors.password}
          helperText={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          testID="signup-password"
        />
        <Button
          title="Create account"
          onPress={onSubmit}
          loading={submitting}
          fullWidth
          testID="signup-submit"
        />
      </View>

      <View style={styles.footer}>
        <AppText variant="callout" color="textSecondary">
          Already have an account?
        </AppText>
        <Button
          title="Sign in"
          variant="tertiary"
          size="sm"
          onPress={goToLogin}
          disabled={submitting}
          testID="signup-sign-in"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xxxl },
  heading: { gap: spacing.sm },
  form: { gap: spacing.lg },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  confirm: { alignItems: 'center', justifyContent: 'center' },
  confirmText: { gap: spacing.sm, maxWidth: 360 },
});
