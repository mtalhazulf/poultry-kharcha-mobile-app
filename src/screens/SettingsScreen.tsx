/**
 * Settings: a short menu. Who you are at the top, then one row per thing you
 * can open. Editing lives on its own screens (Expense types, Staff) so this
 * page stays calm. Admin-only rows are cosmetic — RLS is the real gate.
 */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListGroup, ListRow } from '../components/ListRow';
import { Card, ErrorBanner, IconCircle, RoleBadge } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { useCategories } from '../hooks/useCategories';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Props = RootStackScreenProps<'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { user, profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { categories } = useCategories();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<AppError | null>(null);
  const isAdmin = profile?.role === 'admin';

  const email = profile?.email || user?.email || '';
  const name = profile?.display_name?.trim() || email;
  const typeCount = categories.filter(c => c.active).length;

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <Card style={styles.profile}>
        <IconCircle emoji={isAdmin ? '🛡️' : '👤'} bg={colors.primarySoft} size={64} />
        <View style={styles.profileText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {email && email !== name ? (
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          {profile ? <RoleBadge role={profile.role} /> : null}
        </View>
      </Card>

      <ListGroup title="Manage">
        <ListRow
          icon="🧾"
          title="Expense types"
          subtitle={typeCount === 1 ? '1 type' : `${typeCount} types`}
          onPress={() => navigation.navigate('ExpenseTypes')}
          testID="settings-open-types"
        />
        {isAdmin ? (
          <ListRow
            icon="👥"
            iconBg={colors.sharedSoft}
            title="Staff"
            subtitle="Invite people, admins, accounts"
            onPress={() => navigation.navigate('Staff')}
            testID="settings-open-staff"
          />
        ) : null}
      </ListGroup>

      <ListGroup title="App">
        <ListRow
          icon="❓"
          iconBg={colors.warningSoft}
          title="Help"
          subtitle="See the short guide again"
          onPress={() => navigation.navigate('Walkthrough', { replay: true })}
          testID="settings-help"
        />
        <ListRow
          icon="🚪"
          tone="danger"
          title={signingOut ? 'Signing out…' : 'Sign out'}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileText: { flex: 1, gap: spacing.xs },
  name: { ...typography.heading },
  email: { ...typography.caption },
});
