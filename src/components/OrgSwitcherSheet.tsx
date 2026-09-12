import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { leaveOrganization } from '../api/organizations';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import { radius } from '../theme';
import type { Membership, OrgRole } from '../types/models';
import {
  Avatar,
  Badge,
  ErrorBanner,
  LIST_TEXT_INSET,
  ListGroup,
  ListItem,
  Sheet,
  type AvatarSize,
} from '../ui';

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export function roleLabel(role: OrgRole): string {
  return ROLE_LABELS[role];
}

export interface OrgMarkProps {
  name: string;
  /** 32 / 40 / 56 like Avatar. Default 'md' (matches a list row's leading tile). */
  size?: AvatarSize;
}

/** Rounded-square initials tile for an organization (decorative; the name is always shown next to it). */
export function OrgMark({ name, size = 'md' }: OrgMarkProps) {
  return <Avatar name={name} size={size} accessibilityLabel="" style={styles.mark} />;
}

export interface OrgSwitcherSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Lists the person's organizations (active ones selectable, pending ones with
 * a way to cancel) and offers "Create organization" / "Join with invite code".
 */
export function OrgSwitcherSheet({ visible, onClose }: OrgSwitcherSheetProps) {
  const navigation = useNavigation();
  const { activeMemberships, pendingMemberships, activeOrg, switchOrg, refresh } = useOrg();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const activeOrgId = activeOrg?.id ?? null;
  const busy = switchingTo !== null || cancelling !== null;

  // Approvals happen elsewhere and nothing polls (docs/ARCHITECTURE.md §8):
  // opening the sheet is when a pending request is worth rechecking.
  useEffect(() => {
    if (visible) {
      setError(null);
      refresh();
    }
  }, [visible, refresh]);

  const close = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  const select = useCallback(
    async (orgId: string) => {
      if (orgId === activeOrgId) {
        close();
        return;
      }
      setError(null);
      setSwitchingTo(orgId);
      try {
        await switchOrg(orgId);
        close();
      } catch (err) {
        setError(AppError.from(err));
      } finally {
        setSwitchingTo(null);
      }
    },
    [activeOrgId, close, switchOrg],
  );

  /** Same confirmation as the setup screen, so a request can be dropped from either place. */
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
              setError(null);
              setCancelling(membership.org_id);
              try {
                await leaveOrganization(membership.org_id);
                await refresh();
              } catch (err) {
                setError(AppError.from(err));
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

  const openCreate = useCallback(() => {
    close();
    navigation.navigate('CreateOrg');
  }, [close, navigation]);

  const openJoin = useCallback(() => {
    close();
    navigation.navigate('JoinOrg');
  }, [close, navigation]);

  return (
    <Sheet visible={visible} onClose={close} title="Organizations" testID="org-switcher-sheet">
      <ErrorBanner message={error?.message} kind={error?.kind} />

      <ListGroup separatorInset={LIST_TEXT_INSET}>
        {activeMemberships.map(membership => (
          <ListItem
            key={membership.org_id}
            title={membership.organization.name}
            subtitle={roleLabel(membership.role)}
            leading={<OrgMark name={membership.organization.name} />}
            selected={membership.org_id === activeOrgId}
            disabled={busy}
            onPress={() => select(membership.org_id)}
            testID={`org-option-${membership.org_id}`}
          />
        ))}
      </ListGroup>

      <ListGroup title="Waiting for approval" separatorInset={LIST_TEXT_INSET}>
        {pendingMemberships.flatMap(membership => [
          <ListItem
            key={membership.org_id}
            title={membership.organization.name}
            subtitle="An admin needs to approve"
            leading={<OrgMark name={membership.organization.name} />}
            trailing={<Badge label="Pending" tone="warning" size="sm" />}
            testID={`org-pending-${membership.org_id}`}
          />,
          <ListItem
            key={`${membership.org_id}-cancel`}
            title="Cancel request"
            destructive
            onPress={() => cancelRequest(membership)}
            disabled={busy}
            accessibilityLabel={`Cancel request to join ${membership.organization.name}`}
            testID={`org-pending-cancel-${membership.org_id}`}
            style={styles.cancelRow}
          />,
        ])}
      </ListGroup>

      <ListGroup separatorInset={LIST_TEXT_INSET}>
        <ListItem
          title="Create organization"
          leadingIcon="building-2"
          onPress={openCreate}
          testID="org-switcher-create"
        />
        <ListItem
          title="Join with invite code"
          leadingIcon="key-round"
          onPress={openJoin}
          testID="org-switcher-join"
        />
      </ListGroup>
    </Sheet>
  );
}

export default OrgSwitcherSheet;

const styles = StyleSheet.create({
  mark: { borderRadius: radius.sm },
  // Lines "Cancel request" up with the organization name above it.
  cancelRow: { paddingLeft: LIST_TEXT_INSET },
});
