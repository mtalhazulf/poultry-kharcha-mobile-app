/**
 * Staff (admins): who is waiting to join and who has an account. Tap a person
 * or an invite for their choices; invite from the button at the bottom. Every
 * write is checked by RLS; keeping members out of this screen is for simplicity.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  listMembers,
  listPendingInvites,
  revokeInvite,
  setMemberDisabled,
  setMemberRole,
} from '../api/staff';
import { ListGroup, ListRow } from '../components/ListRow';
import { Sheet } from '../components/Sheet';
import { Badge, Button, EmptyState, ErrorBanner, LoadingView, RoleBadge } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import type { Invite, Profile } from '../types/models';

type Props = RootStackScreenProps<'Staff'>;
type Selection = { kind: 'member'; member: Profile } | { kind: 'invite'; invite: Invite };
type BusyAction = 'role' | 'disabled' | 'revoke';

function memberSubtitle(member: Profile, isSelf: boolean): string {
  return [
    member.display_name ? member.email : null,
    member.role === 'admin' ? 'Admin' : 'Member',
    isSelf ? 'You' : null,
    member.disabled ? 'Disabled' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function StaffScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [actionError, setActionError] = useState<AppError | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const [nextMembers, nextInvites] = await Promise.all([listMembers(), listPendingInvites()]);
      if (mounted.current) {
        setMembers(nextMembers);
        setInvites(nextInvites);
        setLoadError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setLoadError(AppError.from(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Loads on open and again when coming back from the invite screen.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = (next: Selection) => {
    setSelection(next);
    setConfirmingDisable(false);
    setActionError(null);
    setSheetOpen(true);
  };

  const close = () => {
    if (busy) {
      return;
    }
    setSheetOpen(false);
    setConfirmingDisable(false);
    setActionError(null);
  };

  const act = async (kind: BusyAction, action: () => Promise<unknown>) => {
    setBusy(kind);
    setActionError(null);
    try {
      await action();
      await load();
      if (mounted.current) {
        setSheetOpen(false);
        setConfirmingDisable(false);
      }
    } catch (err) {
      if (mounted.current) {
        setActionError(AppError.from(err));
      }
    } finally {
      if (mounted.current) {
        setBusy(null);
      }
    }
  };

  // Cosmetic guard; RLS already refuses non-admins.
  if (profile?.role !== 'admin') {
    return <EmptyState emoji="🔒" title="Admins only" message="Ask your admin to manage staff." />;
  }

  const member = selection?.kind === 'member' ? selection.member : null;
  const invite = selection?.kind === 'invite' ? selection.invite : null;
  const memberName = member ? member.display_name || member.email : '';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorBanner message={loadError?.message} kind={loadError?.kind} onRetry={load} />
        {loading ? <LoadingView message="Loading staff…" /> : null}

        <ListGroup
          title={`Waiting to join (${invites.length})`}
          footer="They can create an account with this email."
        >
          {invites.map(item => (
            <ListRow
              key={item.email}
              icon="✉️"
              iconBg={colors.warningSoft}
              title={item.email}
              subtitle={item.role === 'admin' ? 'Will be an admin' : 'Will be a member'}
              onPress={() => open({ kind: 'invite', invite: item })}
              testID={`invite-row-${item.email}`}
            />
          ))}
        </ListGroup>

        <ListGroup
          title={`Staff (${members.length})`}
          footer={members.length > 1 ? 'Tap a person to change their role or account.' : undefined}
        >
          {members.map(item => {
            const isSelf = item.id === profile.id;
            return (
              <ListRow
                key={item.id}
                icon={item.disabled ? '🚫' : item.role === 'admin' ? '🛡️' : '👤'}
                iconBg={
                  item.disabled
                    ? colors.dangerSoft
                    : item.role === 'admin'
                    ? colors.primarySoft
                    : colors.sharedSoft
                }
                title={item.display_name || item.email}
                subtitle={memberSubtitle(item, isSelf)}
                dimmed={item.disabled}
                // You can't disable or demote yourself, so your own row has no choices.
                onPress={isSelf ? undefined : () => open({ kind: 'member', member: item })}
                testID={`staff-row-${item.email}`}
              />
            );
          })}
        </ListGroup>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button
          size="lg"
          icon="✉️"
          title="Invite someone"
          onPress={() => navigation.navigate('InviteStaff')}
          testID="staff-invite"
        />
      </View>

      <Sheet
        visible={sheetOpen && member !== null}
        title={memberName}
        subtitle={member?.display_name ? member.email : undefined}
        onClose={close}
        testID="staff-member-sheet"
      >
        {member ? (
          <>
            <View style={styles.badges}>
              <RoleBadge role={member.role} />
              {member.disabled ? <Badge label="Disabled" icon="🚫" tone="danger" /> : null}
            </View>
            <ErrorBanner message={actionError?.message} kind={actionError?.kind} />
            {confirmingDisable ? (
              <>
                <Text style={styles.message}>
                  Disable {memberName}? They won't see any expenses until you enable them again.
                </Text>
                <Button
                  size="lg"
                  icon="🚫"
                  title="Yes, disable"
                  variant="danger"
                  loading={busy === 'disabled'}
                  disabled={busy !== null}
                  onPress={() => act('disabled', () => setMemberDisabled(member.id, true))}
                />
                <Button
                  icon="↩️"
                  title="Keep account"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => setConfirmingDisable(false)}
                />
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  icon={member.role === 'admin' ? '👤' : '🛡️'}
                  title={member.role === 'admin' ? 'Make member' : 'Make admin'}
                  variant="secondary"
                  loading={busy === 'role'}
                  disabled={busy !== null}
                  onPress={() =>
                    act('role', () =>
                      setMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin'),
                    )
                  }
                />
                {member.disabled ? (
                  <Button
                    size="lg"
                    icon="✅"
                    title="Enable account"
                    variant="secondary"
                    loading={busy === 'disabled'}
                    disabled={busy !== null}
                    onPress={() => act('disabled', () => setMemberDisabled(member.id, false))}
                  />
                ) : (
                  <Button
                    size="lg"
                    icon="🚫"
                    title="Disable account"
                    variant="danger"
                    disabled={busy !== null}
                    onPress={() => setConfirmingDisable(true)}
                  />
                )}
              </>
            )}
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={sheetOpen && invite !== null}
        title={invite?.email ?? ''}
        subtitle={
          invite ? (invite.role === 'admin' ? 'Invited as admin' : 'Invited as member') : undefined
        }
        onClose={close}
        testID="staff-invite-sheet"
      >
        {invite ? (
          <>
            <ErrorBanner message={actionError?.message} kind={actionError?.kind} />
            <Text style={styles.message}>They haven't created their account yet.</Text>
            <Button
              size="lg"
              icon="🗑️"
              title="Cancel invite"
              variant="danger"
              loading={busy === 'revoke'}
              disabled={busy !== null}
              onPress={() => act('revoke', () => revokeInvite(invite.email))}
            />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  message: { ...typography.body, marginBottom: spacing.sm },
});
