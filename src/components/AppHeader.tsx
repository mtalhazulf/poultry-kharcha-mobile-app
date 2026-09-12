import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useOrg } from '../context/OrgProvider';
import { colors, layout, radius, spacing } from '../theme';
import { AppText, Icon } from '../ui';
import { OrgMark, OrgSwitcherSheet } from './OrgSwitcherSheet';

export interface AppHeaderProps {
  /** Right-hand actions, usually one or two `IconButton`s (each with an accessibilityLabel). */
  right?: React.ReactNode;
  testID?: string;
}

/**
 * `Screen` edges for a tab screen that renders AppHeader: the header paints the
 * status bar area white itself, so the screen must not pad the top.
 *
 *   <Screen header={<AppHeader right={...} />} edges={TAB_SCREEN_EDGES}>
 */
export const TAB_SCREEN_EDGES: ReadonlyArray<Edge> = ['left', 'right'];

const HEADER_EDGES: ReadonlyArray<Edge> = ['top'];

/**
 * Header of the tab screens: org switcher on the left (opens OrgSwitcherSheet),
 * actions on the right. White surface with a hairline bottom border; the top
 * safe-area inset is included (only where the header really overlaps it).
 */
export function AppHeader({ right, testID }: AppHeaderProps) {
  const { activeOrg } = useOrg();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const openSwitcher = useCallback(() => setSwitcherOpen(true), []);
  const closeSwitcher = useCallback(() => setSwitcherOpen(false), []);

  const orgName = activeOrg?.name ?? 'Organization';

  return (
    <SafeAreaView edges={HEADER_EDGES} style={styles.root} testID={testID}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${orgName}. Switch organization`}
          onPress={openSwitcher}
          testID="org-switcher"
          style={({ pressed }) => [styles.switcher, pressed ? styles.switcherPressed : null]}
        >
          <OrgMark name={orgName} size="sm" />
          <AppText variant="headline" numberOfLines={1} style={styles.orgName}>
            {orgName}
          </AppText>
          <Icon name="chevron-down" size={layout.icon.sm} color={colors.textSecondary} />
        </Pressable>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <OrgSwitcherSheet visible={switcherOpen} onClose={closeSwitcher} />
    </SafeAreaView>
  );
}

export default AppHeader;

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
  },
  bar: {
    minHeight: layout.control.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // The switcher's pressed background extends 8dp past the org mark.
    paddingLeft: layout.screenPadding - spacing.sm,
    paddingRight: spacing.sm,
  },
  switcher: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  switcherPressed: { backgroundColor: colors.surfaceMuted },
  orgName: { flexShrink: 1 },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
});
