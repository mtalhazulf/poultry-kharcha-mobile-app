import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExpensesScreen from '../screens/ExpensesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors, layout, spacing, typography } from '../theme';
import { Icon } from '../ui';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Tab icons sit between layout.icon.md and lg so the labels stay the focus. */
const TAB_ICON_SIZE = 22;
/** Bar height above the bottom safe-area inset. */
const TAB_BAR_HEIGHT = layout.control.lg;

interface TabIconProps {
  color: string;
}

function ExpensesIcon({ color }: TabIconProps) {
  return <Icon name="receipt" size={TAB_ICON_SIZE} color={color} />;
}

function ReportsIcon({ color }: TabIconProps) {
  return <Icon name="chart-column" size={TAB_ICON_SIZE} color={color} />;
}

function SettingsIcon({ color }: TabIconProps) {
  return <Icon name="settings" size={TAB_ICON_SIZE} color={color} />;
}

/** Expenses · Reports · Settings. Each tab screen renders its own AppHeader. */
export default function MainTabs() {
  const insets = useSafeAreaInsets();

  const screenOptions = useMemo<BottomTabNavigationOptions>(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textTertiary,
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: styles.label,
      // A custom height replaces the library's, so the bottom inset is added back here;
      // the library still pads the bar by that inset.
      tabBarStyle: [styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom }],
      tabBarHideOnKeyboard: true,
      sceneStyle: styles.scene,
    }),
    [insets.bottom],
  );

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesScreen}
        options={{ title: 'Expenses', tabBarIcon: ExpensesIcon, tabBarButtonTestID: 'tab-expenses' }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{ title: 'Reports', tabBarIcon: ReportsIcon, tabBarButtonTestID: 'tab-reports' }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarIcon: SettingsIcon, tabBarButtonTestID: 'open-settings' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  label: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.subhead.fontWeight,
  },
  scene: { backgroundColor: colors.bg },
});
