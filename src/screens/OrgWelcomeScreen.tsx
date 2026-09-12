import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { leaveOrganization } from '../api/organizations';
import { OrgMark } from '../components/OrgSwitcherSheet';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, formatDate, layout, parseTimestamp, spacing, toIsoDate } from '../theme';
import type { Membership } from '../types/models';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  ErrorBanner,
  Icon,
  IconTile,
  LIST_TEXT_INSET,
  ListItem,
  Screen,
  SectionHeader,
  type IconName,
} from '../ui';

type Props = RootStackScreenProps<'OrgWelcome'>;

function requestedLabel(requestedAt: string): string {
  const date = parseTimestamp(requestedAt);
  return date ? `Requested ${formatDate(toIsoDate(date))}` : 'Request sent';
}

interface OptionCardProps {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
  testID: string;
}

function OptionCard({ icon, title, description, onPress, testID }: OptionCardProps) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${title}. ${description}`}
      testID={testID}
      style={styles.option}
    >
      <IconTile icon={icon} tone="primary" size="lg" />
      <View style={styles.optionText}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="callout" color="textSecondary">
          {description}
        </AppText>
      </View>
      <Icon name="chevron-right" size={layout.icon.md} color={colors.textTertiary} />
    </Card>
  );
}

/** Signed in without an active organization: create one, join one, or wait for approval. */
export default function OrgWelcomeScreen({ navigation }: Props) {
  const { user, profile, signOut } = useAuth();
  const { memberships, pendingMemberships, error: orgError, refresh } = useOrg();

  // An admin can turn someone's access off; without this the person would get
  // the plain setup screen with no hint of why their organization vanished.
  const disabledMemberships = useMemo(
    () => memberships.filter(membership => membership.status === 'disabled'),
    [memberships],
  );

  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [actionError, setActionError] = useState<AppError | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const cancelRequest = useCallback(
    (membership: Membership) => {
      const orgName = membership.organization.name;
      Alert.alert(
        'Cancel request?',
        `You can ask to join ${orgName} again later with an invite code.`,
        [
          { text: 'Keep request', style: 'cancel' },
          {
            text: 'Cancel request',
            style: 'destructive',
            onPress: async () => {
              setActionError(null);
              setCancelling(membership.org_id);
              try {
                await leaveOrganization(membership.org_id);
                await refresh();
              } catch (err) {
                setActionError(AppError.from(err));
              } finally {
                setCancelling(null);
              }
            },
          },
        ],
      );
    },
    [refresh],
  );

  const onSignOut = useCallback(async () => {
    setActionError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      setActionError(AppError.from(err));
      setSigningOut(false);
    }
  }, [signOut]);

  const email = user?.email ?? profile?.email ?? '';

  return (
    <Screen
      scroll
      gap={spacing.xxl}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressBackgroundColor={colors.surface}
        />
      }
      contentStyle={styles.content}
      testID="org-welcome"
    >
      <View style={styles.heading}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Set up your organization
        </AppText>
        <AppText variant="body" color="textSecondary">
          Create a new organization or join an existing one with an invite code.
        </AppText>
      </View>

      <ErrorBanner message={orgError?.message} kind={orgError?.kind} onRetry={onRefresh} />
      <ErrorBanner
        message={actionError?.message}
        kind={actionError?.kind}
        onDismiss={() => setActionError(null)}
      />

      <View style={styles.options}>
        <OptionCard
          icon="building-2"
          title="Create organization"
          description="Start one and invite your team."
          onPress={() => navigation.navigate('CreateOrg')}
          testID="org-welcome-create"
        />
        <OptionCard
          icon="key-round"
          title="Join with invite code"
          description="Use the code an admin shared with you."
          onPress={() => navigation.navigate('JoinOrg')}
          testID="org-welcome-join"
        />
      </View>

      {pendingMemberships.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Waiting for approval"
            action={{
              label: 'Refresh',
              icon: 'refresh-cw',
              onPress: onRefresh,
              testID: 'org-welcome-refresh',
            }}
          />
          {pendingMemberships.map(membership => (
            <Card key={membership.org_id} padded={false}>
              <ListItem
                title={membership.organization.name}
                subtitle={requestedLabel(membership.requested_at)}
                leading={<OrgMark name={membership.organization.name} />}
                trailing={<Badge label="Pending" tone="warning" size="sm" />}
              />
              <Divider inset={LIST_TEXT_INSET} />
              <ListItem
                title="Cancel request"
                destructive
                onPress={() => cancelRequest(membership)}
                disabled={cancelling !== null}
                accessibilityLabel={`Cancel request to join ${membership.organization.name}`}
                testID={`org-welcome-cancel-${membership.org_id}`}
                style={styles.cancelRow}
              />
            </Card>
          ))}
          <AppText variant="caption" color="textSecondary" style={styles.hint}>
            An admin of the organization needs to approve your request. Pull down to check again.
          </AppText>
        </View>
      ) : null}

      {disabledMemberships.length > 0 ? (
        <View style={styles.section} testID="org-welcome-disabled">
          <SectionHeader title="Access turned off" />
          {disabledMemberships.map(membership => (
            <Card key={membership.org_id} padded={false}>
              <ListItem
                title={membership.organization.name}
                subtitle="An admin turned your access off"
                leading={<OrgMark name={membership.organization.name} />}
                trailing={<Badge label="Off" tone="neutral" size="sm" />}
              />
            </Card>
          ))}
          <AppText variant="caption" color="textSecondary" style={styles.hint}>
            Ask an admin of the organization to turn your access back on.
          </AppText>
        </View>
      ) : null}

      <View style={styles.footer}>
        <AppText variant="caption" color="textSecondary" align="center" numberOfLines={1}>
          Signed in as {email}
        </AppText>
        <Button
          title="Sign out"
          variant="tertiary"
          size="sm"
          onPress={onSignOut}
          loading={signingOut}
          testID="org-welcome-sign-out"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xxl },
  heading: { gap: spacing.sm },
  options: { gap: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionText: { flex: 1, gap: spacing.xxs },
  section: { gap: spacing.sm },
  // Lines "Cancel request" up with the organization name above it.
  cancelRow: { paddingLeft: LIST_TEXT_INSET },
  hint: { paddingHorizontal: spacing.xs },
  footer: { marginTop: 'auto', alignItems: 'center', gap: spacing.xs },
});
