import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import type { OrgMember } from '../../types/models';
import { AppText, Avatar, Button } from '../../ui';
import { personName, relativeTimePhrase } from './teamLogic';

export type RequestAction = 'approve' | 'decline';

export interface RequestRowProps {
  member: OrgMember;
  /** The action running for this person, if any. */
  busy: RequestAction | null;
  /** Another request is being handled; keeps presses from overlapping. */
  locked: boolean;
  onApprove: () => void;
  onDecline: () => void;
}

/** A pending join request with Approve / Decline. */
export function RequestRow({ member, busy, locked, onApprove, onDecline }: RequestRowProps) {
  const name = personName(member.profile);
  const email = member.profile.email;
  const showEmail = Boolean(email) && email !== name;
  const when = relativeTimePhrase(member.requested_at);
  const summary = [name, showEmail ? email : null, when ? `Requested ${when}` : null]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.row} testID={`team-request-${member.user_id}`}>
      <Avatar name={member.profile.display_name} email={email} uri={member.profile.avatar_url} />
      <View style={styles.body}>
        <View accessible accessibilityLabel={summary} style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {name}
          </AppText>
          {showEmail ? (
            <AppText variant="callout" color="textSecondary" numberOfLines={1}>
              {email}
            </AppText>
          ) : null}
          {when ? (
            <AppText variant="caption" color="textSecondary">
              {`Requested ${when}`}
            </AppText>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Button
            title="Approve"
            size="sm"
            icon="check"
            onPress={onApprove}
            loading={busy === 'approve'}
            disabled={locked}
            accessibilityLabel={`Approve ${name}`}
            testID={`team-approve-${member.user_id}`}
          />
          <Button
            title="Decline"
            size="sm"
            variant="secondary"
            onPress={onDecline}
            loading={busy === 'decline'}
            disabled={locked}
            accessibilityLabel={`Decline ${name}`}
            testID={`team-decline-${member.user_id}`}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  body: { flex: 1, gap: spacing.md },
  text: { gap: spacing.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
