/**
 * Settings tab: who you are, the active organization, security and app
 * info. Editing lives on the screens these rows open, so this page stays a
 * calm menu. Admin-only controls are on those screens and hidden for members.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import packageJson from '../../package.json';
import { AppHeader } from '../components/AppHeader';
import { EditNameSheet } from '../components/settings/EditNameSheet';
import { biometricRowCopy } from '../components/settings/settingsLogic';
import { useAuth } from '../context/AuthProvider';
import { useBiometricLock } from '../context/BiometricLockProvider';
import { useOrg } from '../context/OrgProvider';
import { useCategories } from '../hooks/useCategories';
import { AppError } from '../lib/errors';
import type { MainTabScreenProps } from '../navigation/types';
import { colors, layout, spacing } from '../theme';
import {
  AppText,
  Avatar,
  Card,
  ErrorBanner,
  Icon,
  LIST_TEXT_INSET,
  ListGroup,
  ListItem,
  Screen,
  Toggle,
} from '../ui';

type Props = MainTabScreenProps<'SettingsTab'>;

/** AppHeader pads the status bar itself. */
const SIDE_EDGES = ['left', 'right'] as const;

export default function SettingsScreen({ navigation }: Props) {
  const { user, profile, signOut } = useAuth();
  const { activeOrg } = useOrg();
  const { available, biometryLabel, enabled, enable, disable } = useBiometricLock();
  const {
    categories,
    loading: typesLoading,
    refresh: refreshTypes,
  } = useCategories(activeOrg?.id ?? null);

  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<AppError | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<AppError | null>(null);

  // Expense types may have changed on their own screen.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        refreshTypes();
      }
      focusedBefore.current = true;
    }, [refreshTypes]),
  );

  const email = profile?.email || user?.email || '';
  const displayName = profile?.display_name?.trim() ?? '';
  const title = displayName || email || 'Your profile';
  const subtitle = displayName ? email : 'Add your name';
  const typeCount = categories.filter(category => category.active).length;
  const biometricCopy = biometricRowCopy(biometryLabel, available, enabled);
  const biometricBlocked = !available && !enabled;

  const openNameSheet = useCallback(() => setNameSheetOpen(true), []);
  const closeNameSheet = useCallback(() => setNameSheetOpen(false), []);

  const toggleBiometric = useCallback(
    async (next: boolean) => {
      setBiometricBusy(true);
      setBiometricError(null);
      try {
        if (next) {
          await enable();
        } else {
          await disable();
        }
      } catch (err) {
        const appErr = AppError.from(err);
        setBiometricError(appErr);
        // A failed/blocked enable attempt (e.g. no biometrics on this device)
        // must not read as "nothing happened" if the inline banner is missed.
        if (next) {
          Alert.alert('Could not turn on biometric sign-in', appErr.message);
        }
      } finally {
        setBiometricBusy(false);
      }
    },
    [enable, disable],
  );

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You can sign in again any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          setSignOutError(null);
          signOut().catch(err => {
            setSignOutError(AppError.from(err));
            setSigningOut(false);
          });
        },
      },
    ]);
  }, [signOut]);

  return (
    <Screen
      scroll
      edges={SIDE_EDGES}
      header={<AppHeader testID="settings-header" />}
      gap={spacing.xxl}
      testID="settings-screen"
    >
      <AppText variant="largeTitle" accessibilityRole="header">
        Settings
      </AppText>

      <Card
        onPress={openNameSheet}
        accessibilityLabel={`${[title, subtitle].filter(Boolean).join(', ')}. Edit your name`}
        style={styles.profile}
        testID="settings-profile"
      >
        <Avatar name={displayName || null} email={email} uri={profile?.avatar_url} />
        <View style={styles.profileText}>
          <AppText variant="headline" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="callout" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevron-right" size={layout.icon.md} color={colors.textTertiary} />
      </Card>

      <ListGroup title="Organization" separatorInset={LIST_TEXT_INSET}>
        <ListItem
          title="Organization"
          leadingIcon="building-complex"
          value={activeOrg?.name}
          onPress={() => navigation.navigate('OrgSettings')}
          testID="settings-open-org"
        />
        <ListItem
          title="Team"
          leadingIcon="users"
          onPress={() => navigation.navigate('Team')}
          testID="settings-open-team"
        />
        <ListItem
          title="Expense types"
          leadingIcon="list"
          value={typesLoading && categories.length === 0 ? undefined : String(typeCount)}
          onPress={() => navigation.navigate('ExpenseTypes')}
          testID="settings-open-types"
        />
      </ListGroup>

      <View style={styles.group}>
        <ListGroup title="Security" separatorInset={LIST_TEXT_INSET}>
          <ListItem
            title={biometricCopy.title}
            subtitle={biometricCopy.subtitle}
            subtitleLines={2}
            leadingIcon={biometryLabel === 'Face unlock' ? 'scan-face' : 'fingerprint-pattern'}
            disabled={biometricBlocked}
            trailing={
              <Toggle
                value={enabled}
                onValueChange={toggleBiometric}
                disabled={biometricBusy || biometricBlocked}
                accessibilityLabel={biometricCopy.title}
                accessibilityHint={biometricCopy.subtitle}
                testID="settings-biometric"
              />
            }
          />
        </ListGroup>
        <ErrorBanner
          message={biometricError?.message}
          kind={biometricError?.kind}
          onDismiss={() => setBiometricError(null)}
        />
      </View>

      <ListGroup title="App" separatorInset={LIST_TEXT_INSET}>
        <ListItem
          title="Help and guide"
          leadingIcon="circle-question-mark"
          onPress={() => navigation.navigate('Walkthrough', { replay: true })}
          testID="settings-help"
        />
        <ListItem
          title="About"
          leadingIcon="info"
          value={`Version ${packageJson.version}`}
          testID="settings-about"
        />
      </ListGroup>

      <View style={styles.group}>
        <ListGroup separatorInset={LIST_TEXT_INSET}>
          <ListItem
            title={signingOut ? 'Signing out' : 'Sign out'}
            leadingIcon="log-out"
            destructive
            onPress={confirmSignOut}
            disabled={signingOut}
            testID="settings-signout"
          />
        </ListGroup>
        <ErrorBanner
          message={signOutError?.message}
          kind={signOutError?.kind}
          onDismiss={() => setSignOutError(null)}
        />
      </View>

      <EditNameSheet
        visible={nameSheetOpen}
        initialName={displayName}
        email={email}
        onClose={closeNameSheet}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileText: { flex: 1, gap: spacing.xxs },
  group: { gap: spacing.md },
});
