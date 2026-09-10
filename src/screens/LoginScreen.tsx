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
import { Button, ErrorBanner, TextField } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { validateEmail, validatePassword } from '../lib/auth';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing, touch, typography } from '../theme';

type Props = RootStackScreenProps<'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signInWithPassword, signInWithGoogle, lastAuthError, clearAuthError } = useAuth();
  const insets = useSafeAreaInsets();

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

  const onSignIn = useCallback(async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) {
      return;
    }
    dismissError();
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      // Success: the auth state change swaps the navigator to the app stack.
    } catch (err) {
      setError(AppError.from(err));
    } finally {
      setSubmitting(false);
    }
  }, [email, password, signInWithPassword, dismissError]);

  const onGoogle = useCallback(async () => {
    dismissError();
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(AppError.from(err));
    } finally {
      setGoogleBusy(false);
    }
  }, [signInWithGoogle, dismissError]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroEmoji} accessible={false}>
            💰
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            Kharcha
          </Text>
          <Text style={styles.tagline}>Keep track of your money</Text>
        </View>

        <ErrorBanner
          message={shownError?.message}
          kind={shownError?.kind}
          onDismiss={dismissError}
        />

        <TextField
          icon="📧"
          testID="login-email"
          accessibilityLabel="Email"
          value={email}
          onChangeText={text => {
            setEmail(text);
            if (emailError) {
              setEmailError(null);
            }
          }}
          onBlur={() => setEmailError(email ? validateEmail(email) : null)}
          error={emailError}
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!busy}
        />
        <TextField
          icon="🔒"
          testID="login-password"
          accessibilityLabel="Password"
          value={password}
          onChangeText={text => {
            setPassword(text);
            if (passwordError) {
              setPasswordError(null);
            }
          }}
          error={passwordError}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={onSignIn}
          editable={!busy}
        />

        <Button
          size="lg"
          icon="➡️"
          title="Enter"
          testID="login-submit"
          onPress={onSignIn}
          loading={submitting}
          disabled={googleBusy}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          icon="G"
          title="Continue with Google"
          variant="secondary"
          onPress={onGoogle}
          loading={googleBusy}
          disabled={submitting}
        />

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="New here? Create account"
          onPress={() => navigation.navigate('SignUp')}
          disabled={busy}
          style={({ pressed }) => [styles.footer, pressed && styles.footerPressed]}
        >
          <Text style={styles.footerText}>New here?</Text>
          <Text style={styles.footerLink}>Create account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', marginBottom: spacing.xxl, gap: spacing.sm },
  heroEmoji: { fontSize: 72, lineHeight: 88 },
  title: { ...typography.display, color: colors.primary },
  tagline: { ...typography.body, color: colors.textMuted },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption },
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
});
