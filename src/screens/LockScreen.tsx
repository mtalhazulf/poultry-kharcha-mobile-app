import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthProvider';
import { useBiometricLock } from '../context/BiometricLockProvider';
import type { BiometryLabel } from '../lib/biometrics';
import { AppError } from '../lib/errors';
import { spacing } from '../theme';
import { AppText, Avatar, Button, Screen } from '../ui';

/** "Use your … to unlock." */
const BIOMETRY_NOUN: Record<BiometryLabel, string> = {
  Fingerprint: 'fingerprint',
  'Face unlock': 'face',
  Biometrics: 'biometrics',
};

/**
 * Shown while the biometric lock is on. Prompts once as soon as the app is in
 * the foreground; "Sign in with password" signs out so the person can use the
 * sign-in screen instead.
 */
export default function LockScreen() {
  const { user, profile, signOut } = useAuth();
  const { biometryLabel, unlock } = useBiometricLock();

  const [unlocking, setUnlocking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const mounted = useRef(true);
  const prompted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const attemptUnlock = useCallback(async () => {
    setFailed(false);
    setUnlocking(true);
    let unlocked = false;
    try {
      unlocked = await unlock();
    } catch {
      unlocked = false;
    }
    // On success the navigator replaces this screen; nothing left to update.
    if (mounted.current) {
      setUnlocking(false);
      setFailed(!unlocked);
    }
  }, [unlock]);

  // Prompt once on mount. The system prompt needs the app in the foreground.
  useEffect(() => {
    const promptOnce = () => {
      if (!prompted.current) {
        prompted.current = true;
        attemptUnlock();
      }
    };
    if (AppState.currentState === 'active') {
      promptOnce();
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        promptOnce();
      }
    });
    return () => subscription.remove();
  }, [attemptUnlock]);

  const usePassword = useCallback(async () => {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      if (mounted.current) {
        setSignOutError(AppError.from(err).message);
      }
    } finally {
      if (mounted.current) {
        setSigningOut(false);
      }
    }
  }, [signOut]);

  const name = profile?.display_name?.trim() || null;
  const email = user?.email ?? profile?.email ?? null;
  const faceUnlock = biometryLabel === 'Face unlock';

  return (
    <Screen
      background="surface"
      gap={spacing.xxl}
      contentStyle={styles.content}
      footer={
        <>
          <Button
            title="Unlock"
            icon={faceUnlock ? 'scan-face' : 'fingerprint'}
            onPress={attemptUnlock}
            loading={unlocking}
            disabled={signingOut}
            fullWidth
            testID="lock-unlock"
          />
          <Button
            title="Sign in with password"
            variant="tertiary"
            onPress={usePassword}
            loading={signingOut}
            fullWidth
            testID="lock-use-password"
          />
        </>
      }
      testID="lock-screen"
    >
      <View style={styles.identity}>
        <Avatar name={name} email={email} uri={profile?.avatar_url} size="lg" />
        <View style={styles.identityText}>
          {name ? (
            <AppText variant="headline" align="center" numberOfLines={1}>
              {name}
            </AppText>
          ) : null}
          {email ? (
            <AppText variant="callout" color="textSecondary" align="center" numberOfLines={1}>
              {email}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.message}>
        <AppText variant="title" align="center" accessibilityRole="header">
          Locked
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Use your {BIOMETRY_NOUN[biometryLabel]} to unlock.
        </AppText>
        {failed ? (
          <AppText
            variant="callout"
            color="dangerText"
            align="center"
            accessibilityLiveRegion="polite"
            testID="lock-failed"
          >
            Not unlocked. Try again, or sign in with your password.
          </AppText>
        ) : null}
        {signOutError ? (
          <AppText variant="callout" color="dangerText" align="center" accessibilityLiveRegion="polite">
            {signOutError}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', gap: spacing.md, maxWidth: '100%' },
  identityText: { alignItems: 'center', gap: spacing.xxs, maxWidth: '100%' },
  message: { alignItems: 'center', gap: spacing.sm, maxWidth: 360 },
});
