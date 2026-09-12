/**
 * One person in the active organization. Admins change role and access and
 * remove people; the owner can hand over ownership. The actions shown follow
 * the RPC rules (teamLogic.memberPermissions): nothing on yourself or on the
 * owner, and the database re-checks every call.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import {
  approveJoinRequest,
  declineJoinRequest,
  listOrgMembers,
  removeMember,
  setMemberRole,
  setMemberStatus,
} from '../api/members';
import { transferOwnership } from '../api/organizations';
import { listWalletEntries } from '../api/wallet';
import {
  memberDateLine,
  memberPermissions,
  personName,
  roleLabel,
  roleTone,
} from '../components/team/teamLogic';
import { sumBalance } from '../components/wallet/walletLogic';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, CURRENCY, layout, radius, spacing } from '../theme';
import type { OrgMember } from '../types/models';
import {
  AppText,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ListGroup,
  ListItem,
  Money,
  Screen,
  SectionHeader,
  Segmented,
  Skeleton,
  Toggle,
  type SegmentedOption,
} from '../ui';

type Props = RootStackScreenProps<'MemberDetail'>;
type Busy = 'role' | 'status' | 'remove' | 'transfer' | 'approve' | 'decline';
type LoadMode = 'initial' | 'refresh' | 'silent';

const ROLE_OPTIONS: ReadonlyArray<SegmentedOption<'admin' | 'member'>> = [
  { value: 'admin', label: 'Admin', testID: 'member-role-admin' },
  { value: 'member', label: 'Member', testID: 'member-role-member' },
];

export default function MemberDetailScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { user } = useAuth();
  const { activeOrg, role: viewerRole, refresh: refreshOrg } = useOrg();
  const orgId = activeOrg?.id ?? null;
  const orgName = activeOrg?.name ?? 'this organization';
  const currency = activeOrg?.currency || CURRENCY;

  const [member, setMember] = useState<OrgMember | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const mounted = useRef(true);
  const seq = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: LoadMode) => {
      if (!orgId) {
        return;
      }
      const id = ++seq.current;
      const isCurrent = () => mounted.current && id === seq.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      try {
        const list = await listOrgMembers(orgId);
        if (!isCurrent()) {
          return;
        }
        setMember(list.find(m => m.user_id === userId) ?? null);
        setLoaded(true);
        setLoadError(null);
      } catch (err) {
        if (isCurrent()) {
          setLoadError(AppError.from(err));
        }
      } finally {
        if (isCurrent()) {
          setRefreshing(false);
        }
      }
    },
    [orgId, userId],
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  useEffect(() => {
    if (!orgId) {
      return;
    }
    let active = true;
    setWalletBalance(null);
    listWalletEntries(orgId, userId)
      .then(entries => {
        if (active) {
          setWalletBalance(sumBalance(entries));
        }
      })
      .catch(() => {
        if (active) {
          setWalletBalance(0);
        }
      });
    return () => {
      active = false;
    };
  }, [orgId, userId]);

  const name = member ? personName(member.profile) : '';

  /** Runs one RPC with shared busy/error handling; `optimistic` is undone on failure. */
  const run = useCallback(
    async (
      kind: Busy,
      action: () => Promise<void>,
      { optimistic, onDone }: { optimistic?: OrgMember; onDone?: () => void } = {},
    ) => {
      if (busy) {
        return;
      }
      const before = member;
      setBusy(kind);
      setActionError(null);
      setNotice(null);
      if (optimistic) {
        setMember(optimistic);
      }
      try {
        await action();
        if (mounted.current) {
          onDone?.();
        }
      } catch (err) {
        if (mounted.current) {
          if (optimistic) {
            setMember(before);
          }
          setActionError(AppError.from(err));
          load('silent');
        }
      } finally {
        if (mounted.current) {
          setBusy(null);
        }
      }
    },
    [busy, member, load],
  );

  const changeRole = useCallback(
    (next: 'admin' | 'member') => {
      if (!orgId || !member || member.role === next) {
        return;
      }
      run('role', () => setMemberRole(orgId, member.user_id, next), {
        optimistic: { ...member, role: next },
      });
    },
    [orgId, member, run],
  );

  const applyStatus = useCallback(
    (next: 'active' | 'disabled') => {
      if (!orgId || !member) {
        return;
      }
      run('status', () => setMemberStatus(orgId, member.user_id, next), {
        optimistic: { ...member, status: next },
      });
    },
    [orgId, member, run],
  );

  const onAccessChange = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        applyStatus('active');
        return;
      }
      Alert.alert(
        `Turn off access for ${name}?`,
        `They can't open ${orgName} or add expenses until you turn access back on.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn off', style: 'destructive', onPress: () => applyStatus('disabled') },
        ],
      );
    },
    [applyStatus, name, orgName],
  );

  const confirmRemove = useCallback(() => {
    if (!orgId || !member) {
      return;
    }
    Alert.alert(
      `Remove ${name}?`,
      `They lose access to ${orgName} right away. Expenses they added stay in the organization.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            run('remove', () => removeMember(orgId, member.user_id), {
              onDone: () => navigation.goBack(),
            });
          },
        },
      ],
    );
  }, [orgId, member, name, orgName, run, navigation]);

  const confirmTransfer = useCallback(() => {
    if (!orgId || !member) {
      return;
    }
    Alert.alert(
      'Transfer ownership?',
      `${name} becomes the owner of ${orgName}. You stay on as an admin and can no longer transfer ownership.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => {
            run(
              'transfer',
              async () => {
                await transferOwnership(orgId, member.user_id);
                await Promise.all([refreshOrg(), load('silent')]);
              },
              { onDone: () => setNotice(`${name} is now the owner of ${orgName}.`) },
            );
          },
        },
      ],
    );
  }, [orgId, member, name, orgName, run, refreshOrg, load]);

  const approve = useCallback(() => {
    if (!orgId || !member) {
      return;
    }
    run('approve', () => approveJoinRequest(orgId, member.user_id), {
      optimistic: { ...member, status: 'active', approved_at: new Date().toISOString() },
    });
  }, [orgId, member, run]);

  const decline = useCallback(() => {
    if (!orgId || !member) {
      return;
    }
    run('decline', () => declineJoinRequest(orgId, member.user_id), {
      onDone: () => navigation.goBack(),
    });
  }, [orgId, member, run, navigation]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        load('refresh');
      }}
      colors={[colors.primary]}
      tintColor={colors.primary}
    />
  );

  if (!loaded) {
    return (
      <Screen scroll gap={spacing.xxl} refreshControl={refreshControl} testID="member-detail">
        <ErrorBanner
          message={loadError?.message}
          kind={loadError?.kind}
          onRetry={() => {
            load('initial');
          }}
        />
        {loadError ? null : (
          <Card style={styles.header} accessibilityLabel="Loading">
            <Skeleton circle height={56} />
            <Skeleton width="50%" height={20} />
            <Skeleton width="65%" height={14} />
            <Skeleton width={120} height={24} radius={radius.full} />
          </Card>
        )}
      </Screen>
    );
  }

  if (!member) {
    return (
      <Screen testID="member-detail">
        <EmptyState
          fill
          icon="user-x"
          title="Not in this organization"
          message="This person left or was removed."
          action={{ label: 'Back to team', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const isSelf = user?.id === member.user_id;
  const perms = memberPermissions({ userId: user?.id ?? null, role: viewerRole }, member);
  const email = member.profile.email;
  const showEmail = Boolean(email) && email !== name;
  const dateLine = memberDateLine(member);
  const locked = busy !== null;
  const viewerIsAdmin = viewerRole === 'owner' || viewerRole === 'admin';
  const anyAction =
    perms.canReview ||
    perms.canChangeRole ||
    perms.canChangeStatus ||
    perms.canRemove ||
    perms.canTransfer;
  let note: string | null = null;
  if (viewerIsAdmin && !anyAction) {
    note = isSelf
      ? "You can't change your own role or access."
      : member.role === 'owner'
      ? "The owner's role and access can't be changed."
      : null;
  }

  return (
    <Screen scroll gap={spacing.xxl} refreshControl={refreshControl} testID="member-detail">
      <ErrorBanner
        message={loadError?.message}
        kind={loadError?.kind}
        onRetry={() => {
          load('initial');
        }}
      />
      <ErrorBanner
        message={actionError?.message}
        kind={actionError?.kind}
        onDismiss={() => setActionError(null)}
      />
      {notice ? <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <Card style={styles.header}>
        <Avatar
          size="lg"
          name={member.profile.display_name}
          email={email}
          uri={member.profile.avatar_url}
        />
        <View style={styles.identity}>
          <AppText variant="title" align="center" numberOfLines={2} accessibilityRole="header">
            {name}
          </AppText>
          {showEmail ? (
            <AppText variant="callout" color="textSecondary" align="center" selectable>
              {email}
            </AppText>
          ) : null}
        </View>
        <View style={styles.badges}>
          <Badge label={roleLabel(member.role)} tone={roleTone(member.role)} />
          {member.status === 'disabled' ? <Badge label="Disabled" tone="danger" /> : null}
          {member.status === 'pending' ? <Badge label="Waiting for approval" tone="warning" /> : null}
          {isSelf ? <Badge label="You" tone="neutral" /> : null}
        </View>
        {dateLine ? (
          <AppText variant="caption" color="textSecondary" align="center">
            {dateLine}
          </AppText>
        ) : null}
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Wallet" />
        <Card style={styles.cardBody}>
          <View style={styles.walletRow}>
            <AppText variant="callout" color="textSecondary">
              Balance
            </AppText>
            {walletBalance === null ? (
              <Skeleton width={80} height={20} />
            ) : (
              <Money
                amount={walletBalance}
                currency={currency}
                color={walletBalance > 0 ? 'primaryText' : 'textSecondary'}
                testID="member-wallet-balance"
              />
            )}
          </View>
          <Button
            title="View wallet"
            icon="banknote"
            variant="secondary"
            onPress={() => navigation.navigate('Wallet', { userId: member.user_id })}
            testID="member-view-wallet"
          />
        </Card>
      </View>

      {perms.canReview ? (
        <View style={styles.section}>
          <SectionHeader title="Join request" />
          <Card style={styles.cardBody}>
            <AppText variant="callout" color="textSecondary">
              {`${name} asked to join ${orgName}.`}
            </AppText>
            <View style={styles.buttons}>
              <Button
                title="Approve"
                icon="check"
                onPress={approve}
                loading={busy === 'approve'}
                disabled={locked}
                style={styles.button}
                testID="member-approve"
              />
              <Button
                title="Decline"
                variant="secondary"
                onPress={decline}
                loading={busy === 'decline'}
                disabled={locked}
                style={styles.button}
                testID="member-decline"
              />
            </View>
          </Card>
        </View>
      ) : null}

      {perms.canChangeRole && member.role !== 'owner' ? (
        <View style={styles.section}>
          <SectionHeader title="Role" />
          <Segmented
            options={ROLE_OPTIONS}
            value={member.role}
            onChange={changeRole}
            disabled={locked}
            testID="member-role"
          />
          <AppText variant="caption" color="textSecondary" style={styles.hint}>
            {member.role === 'admin'
              ? 'Admins see every expense and manage expense types, the invite code and people.'
              : 'Members add expenses and see their own plus ones shared with them.'}
          </AppText>
        </View>
      ) : null}

      {perms.canChangeStatus ? (
        <ListGroup title="Access">
          <ListItem
            title={member.status === 'active' ? 'Active' : 'Disabled'}
            subtitle={
              member.status === 'active'
                ? `Can open ${orgName} and add expenses`
                : `Can't open ${orgName} until access is turned back on`
            }
            subtitleLines={2}
            trailing={
              <Toggle
                value={member.status === 'active'}
                onValueChange={onAccessChange}
                disabled={locked}
                accessibilityLabel="Access"
                testID="member-access"
              />
            }
          />
        </ListGroup>
      ) : null}

      {perms.canTransfer ? (
        <View style={styles.section}>
          <SectionHeader title="Ownership" />
          <Card style={styles.cardBody}>
            <AppText variant="callout" color="textSecondary">
              {`Make ${name} the owner of ${orgName}. You will become an admin.`}
            </AppText>
            <Button
              title="Transfer ownership"
              icon="crown"
              variant="secondary"
              onPress={confirmTransfer}
              loading={busy === 'transfer'}
              disabled={locked}
              testID="member-transfer"
            />
          </Card>
        </View>
      ) : null}

      {perms.canRemove ? (
        <Button
          title="Remove from organization"
          icon="user-x"
          variant="danger"
          onPress={confirmRemove}
          loading={busy === 'remove'}
          disabled={locked}
          testID="member-remove"
        />
      ) : null}

      {note ? (
        <AppText variant="callout" color="textSecondary" align="center">
          {note}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  identity: { alignItems: 'center', gap: spacing.xxs, alignSelf: 'stretch' },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs + spacing.xxs,
  },
  section: { gap: spacing.sm },
  cardBody: { gap: spacing.md },
  walletRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { flexGrow: 1, flexBasis: 120 },
  hint: { paddingHorizontal: spacing.xs, minHeight: layout.icon.sm },
});
