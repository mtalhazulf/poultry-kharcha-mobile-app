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
import { colors, spacing, touch, typography } from '../theme';

type Props = RootStackScreenProps<'SignUp'>;

interface FieldErrors {
  email?: string | null;
  password?: string | null;
  confirm?: string | null;
}

/** The text of an error, or of the error it wraps, when either mentions `needle`. */
function findMessage(err: unknown, needle: RegExp, depth = 0): string | null {
  if (typeof err !== 'object' || err === null || depth > 3) {
    return null;
  }
  const { message, cause } = err as { message?: unknown; cause?: unknown };
  if (typeof message === 'string' && needle.test(message)) {
    return message;
  }
  return findMessage(cause, needle, depth + 1);
}

/**
 * The database rejects uninvited emails with a permission error whose text
 * ("This app is invite-only. Ask your admin to add …") is already written for
 * the user, so keep it instead of the generic "no permission" wording.
 */
function toSignUpError(err: unknown): AppError {
  const inviteMessage = findMessage(err, /invite-only/i);
  return inviteMessage ? new AppError('permission', inviteMessage, err) : AppError.from(err);
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
      setError(toSignUpError(err));
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
        <Text style={styles.heroEmoji} accessible={false}>
          📬
        </Text>
        <Text style={styles.confirmTitle} accessibilityRole="header">
          Almost there
        </Text>
        <InfoBanner icon="✉️" message="Check your inbox to confirm your email, then sign in." />
        <Text style={styles.confirmHint}>
          We sent a confirmation link to {email.trim()}. It may take a minute to arrive.
        </Text>
        <Button
          size="lg"
          icon="➡️"
          title="Back to sign in"
          onPress={goToLogin}
          style={styles.confirmButton}
        />
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
        <View style={styles.hero}>
          <Text style={styles.heroEmoji} accessible={false}>
            🙋
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            Create account
          </Text>
        </View>

        <InfoBanner icon="🔒" message="Staff only. Your admin must add your email first." />
        <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />

        <TextField
          icon="👤"
          accessibilityLabel="Your name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextField
          icon="📧"
          accessibilityLabel="Email"
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
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextField
          icon="🔒"
          accessibilityLabel="Password"
          value={password}
          onChangeText={text => {
            setPassword(text);
            clearField('password');
            clearField('confirm');
          }}
          error={fieldErrors.password}
          hint="At least 8 characters."
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextField
          icon="🔒"
          accessibilityLabel="Repeat password"
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
          placeholder="Repeat password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          editable={!submitting}
        />

        <Button
          size="lg"
          icon="✅"
          title="Create account"
          onPress={onSubmit}
          loading={submitting}
        />

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Sign in"
          onPress={goToLogin}
          disabled={submitting}
          style={({ pressed }) => [styles.footer, pressed && styles.footerPressed]}
        >
          <Text style={styles.footerText}>Already have an account?</Text>
          <Text style={styles.footerLink}>Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  heroEmoji: { fontSize: 72, lineHeight: 88, textAlign: 'center' },
  title: { ...typography.title, color: colors.primary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minHeight: touch.min,
    marginTop: spacing.xl,
  },
  footerPressed: { opacity: 0.7 },
  footerText: { ...typography.body, color: colors.textMuted },
  footerLink: { ...typography.bodyStrong, color: colors.primary },
  confirmWrap: { padding: spacing.xl, justifyContent: 'center', alignItems: 'stretch' },
  confirmTitle: { ...typography.title, marginBottom: spacing.lg, textAlign: 'center' },
  confirmHint: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  confirmButton: { marginTop: spacing.xl },
});
