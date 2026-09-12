import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, layout, spacing } from '../../theme';
import type { OrgMember } from '../../types/models';
import { AppText, Avatar, Badge, Icon } from '../../ui';
import { personName, roleLabel, roleTone } from './teamLogic';

export interface MemberRowProps {
  member: OrgMember;
  isSelf: boolean;
  /** Admins only; members get a read-only row without a chevron. */
  onPress?: () => void;
}

export function MemberRow({ member, isSelf, onPress }: MemberRowProps) {
  const name = personName(member.profile);
  const email = member.profile.email;
  const showEmail = Boolean(email) && email !== name;
  const disabled = member.status === 'disabled';
  const label = [
    name,
    isSelf ? 'You' : null,
    showEmail ? email : null,
    roleLabel(member.role),
    disabled ? 'Disabled' : null,
  ]
    .filter(Boolean)
    .join(', ');
  const testID = `team-member-${member.user_id}`;

  const content = (
    <>
      <Avatar name={member.profile.display_name} email={email} uri={member.profile.avatar_url} />
      <View style={styles.body}>
        <View style={styles.nameLine}>
          <AppText variant="body" numberOfLines={1} style={styles.name}>
            {name}
          </AppText>
          {isSelf ? (
            <AppText variant="caption" color="textSecondary">
              You
            </AppText>
          ) : null}
        </View>
        {showEmail ? (
          <AppText variant="callout" color="textSecondary" numberOfLines={1}>
            {email}
          </AppText>
        ) : null}
      </View>
      <View style={styles.badges}>
        <Badge label={roleLabel(member.role)} tone={roleTone(member.role)} size="sm" />
        {disabled ? <Badge label="Disabled" tone="danger" size="sm" /> : null}
      </View>
      {onPress ? (
        <Icon name="chevron-right" size={layout.icon.md} color={colors.textTertiary} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens role and access settings"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  body: { flex: 1, gap: spacing.xxs },
  nameLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: { flexShrink: 1 },
  badges: { alignItems: 'flex-end', gap: spacing.xs },
});
