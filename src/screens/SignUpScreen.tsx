import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner, InfoBanner, TextField } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { validateEmail, validatePassword } from '../lib/auth';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Props = RootStackScreenProps<'SignUp'>;

interface FieldErrors {
  email?: string | null;
  password?: string | null;
  confirm?: string | null;
}

export default function SignUpScreen({ navigation }: Props) {
  const { signUpWithPassword } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const validate = useCallback((): boolean => {
    const next: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: confirm !== password ? 'Passwords do not match.' : null,
    };
    setFieldErrors(next);
    return !next.email && !next.password && !next.confirm;
  }, [email, password, confirm]);

  const onSubmit = useCallback(async () => {
    if (!validate()) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(
        email,
        password,
        displayName.trim() || undefined,
      );
      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      }
      // Otherwise the session exists and the navigator switches stacks.
    } catch (err) {
      setError(AppError.from(err));
    } finally {
      setSubmitting(false);
    }
  }, [validate, signUpWithPassword, email, password, displayName]);

  const goToLogin = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  }, [navigation]);

  const clearField = (key: keyof FieldErrors) => {
    if (fieldErrors[key]) {
      setFieldErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  if (needsConfirmation) {
    return (
      <View
        style={[styles.flex, styles.confirmWrap, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Text style={styles.confirmTitle}>Almost there</Text>
        <InfoBanner message="Check your inbox to confirm your email, then sign in." />
        <Text style={styles.confirmHint}>
          We sent a confirmation link to {email.trim()}. It may take a minute to arrive.
        </Text>
        <Button title="Back to sign in" onPress={goToLogin} style={styles.confirmButton} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Create an account to start tracking expenses and sharing them with others.
        </Text>

        <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />

        <TextField
          label="Display name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How others will see you"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={text => {
            setEmail(text);
            clearField('email');
          }}
          onBlur={() => {
            if (email) {
              setFieldErrors(prev => ({ ...prev, email: validateEmail(email) }));
            }
          }}
          error={fieldErrors.email}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={text => {
            setPassword(text);
            clearField('password');
            clearField('confirm');
          }}
          error={fieldErrors.password}
          hint="At least 8 characters."
          placeholder="Choose a password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextField
          label="Confirm password"
          value={confirm}
          onChangeText={text => {
            setConfirm(text);
            clearField('confirm');
          }}
          onBlur={() => {
            if (confirm && confirm !== password) {
              setFieldErrors(prev => ({ ...prev, confirm: 'Passwords do not match.' }));
            }
          }}
          error={fieldErrors.confirm}
          placeholder="Repeat your password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          editable={!submitting}
        />

        <Button title="Create account" onPress={onSubmit} loading={submitting} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable accessibilityRole="link" onPress={goToLogin} disabled={submitting} hitSlop={8}>
            <Text style={styles.footerLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl },
  intro: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxl,
  },
  footerText: { ...typography.body, color: colors.textMuted },
  footerLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
  confirmWrap: { padding: spacing.xl, justifyContent: 'center' },
  confirmTitle: { ...typography.title, marginBottom: spacing.lg, textAlign: 'center' },
  confirmHint: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  confirmButton: { marginTop: spacing.xl },
});
