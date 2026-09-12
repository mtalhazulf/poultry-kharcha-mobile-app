import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface SectionHeaderAction {
  label: string;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
}

export interface SectionHeaderProps {
  title: string;
  action?: SectionHeaderAction;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ACTION_HIT_SLOP = { left: 8, right: 8 };

/** Small uppercase label above a group, with an optional text action. */
export function SectionHeader({ title, action, style, testID }: SectionHeaderProps) {
  return (
    // With an action the row grows to the minimum touch target and the action
    // stretches to fill it: vertical hitSlop would spill past the row, where
    // Android's hit testing never looks for it.
    <View style={[styles.row, action ? styles.rowWithAction : null, style]} testID={testID}>
      <AppText
        variant="overline"
        color="textSecondary"
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </AppText>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={ACTION_HIT_SLOP}
          testID={action.testID}
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
        >
          {action.icon ? (
            <Icon name={action.icon} size={layout.icon.sm} color={colors.primaryText} />
          ) : null}
          <AppText variant="subhead" color="primaryText" style={styles.actionLabel}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 28,
    paddingHorizontal: spacing.xs,
  },
  rowWithAction: { minHeight: layout.minTouch },
  title: { flexShrink: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginRight: -spacing.xs,
    borderRadius: radius.xs,
  },
  actionPressed: { backgroundColor: colors.primarySubtle },
  actionLabel: { fontWeight: '600' },
});
