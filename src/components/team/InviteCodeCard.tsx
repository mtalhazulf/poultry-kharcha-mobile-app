import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { formatInviteCode } from '../../api/organizations';
import type { AppError } from '../../lib/errors';
import { colors, layout, radius, spacing } from '../../theme';
import { AppText, Button, Card, ErrorBanner, SectionHeader, Skeleton } from '../../ui';
import { spokenInviteCode } from './teamLogic';

export interface InviteCodeCardProps {
  /** Raw 8-character code, or null while loading / after a failure. */
  code: string | null;
  loading: boolean;
  error: AppError | null;
  onRetry: () => void;
  onShare: () => void;
  onReset: () => void;
  resetting: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/** Admins: the organization's invite code with share and reset actions. */
export function InviteCodeCard({
  code,
  loading,
  error,
  onRetry,
  onShare,
  onReset,
  resetting,
  onLayout,
}: InviteCodeCardProps) {
  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <SectionHeader title="Invite people" />
      <Card style={styles.card} testID="team-invite-card">
        <ErrorBanner
          message={error?.message}
          kind={error?.kind}
          onRetry={code ? undefined : onRetry}
        />
        {code ? (
          <View style={styles.codeBox}>
            <AppText
              variant="largeTitle"
              align="center"
              tabular
              selectable
              numberOfLines={1}
              accessibilityLabel={`Invite code ${spokenInviteCode(code)}`}
              style={styles.code}
              testID="team-invite-code"
            >
              {formatInviteCode(code)}
            </AppText>
          </View>
        ) : loading ? (
          <Skeleton height={layout.control.lg + spacing.lg} radius={radius.md} />
        ) : null}
        <AppText variant="callout" color="textSecondary">
          People who join with this code need your approval.
        </AppText>
        <View style={styles.actions}>
          <Button
            title="Share code"
            icon="share-2"
            onPress={onShare}
            disabled={!code || resetting}
            style={styles.action}
            testID="team-share-code"
          />
          <Button
            title="Reset code"
            icon="refresh-cw"
            variant="secondary"
            onPress={onReset}
            loading={resetting}
            disabled={!code}
            style={styles.action}
            testID="team-reset-code"
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: { gap: spacing.md },
  codeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  code: { letterSpacing: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 120 },
});
