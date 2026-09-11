import { NavigationContainer, useNavigation, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoadingView } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { hasSeenWalkthrough } from '../lib/walkthrough';
import DashboardScreen from '../screens/DashboardScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import ExpenseTypeEditScreen from '../screens/ExpenseTypeEditScreen';
import ExpenseTypesScreen from '../screens/ExpenseTypesScreen';
import InviteStaffScreen from '../screens/InviteStaffScreen';
import LoginScreen from '../screens/LoginScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignUpScreen from '../screens/SignUpScreen';
import StaffScreen from '../screens/StaffScreen';
import WalkthroughScreen from '../screens/WalkthroughScreen';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Auth callbacks (kharcha://auth/callback) are consumed by AuthProvider, so no
// screen is mapped here; the prefix is declared so React Navigation doesn't
// treat those URLs as unknown routes.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kharcha://'],
  config: { screens: {} },
};

function HelpButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Help"
      onPress={() => navigation.navigate('Walkthrough', { replay: true })}
      hitSlop={8}
      style={styles.headerButton}
      testID="dashboard-help"
    >
      <Text style={styles.headerButtonText}>❓ Help</Text>
    </Pressable>
  );
}

/** Sign-out lives inside Settings now, so the header stays to two buttons. */
function SettingsButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      onPress={() => navigation.navigate('Settings')}
      hitSlop={8}
      style={[styles.headerButton, styles.headerIconButton]}
      testID="open-settings"
    >
      <Text style={styles.headerIcon}>⚙️</Text>
    </Pressable>
  );
}

const renderDashboardRight = () => (
  <View style={styles.headerRight}>
    <HelpButton />
    <SettingsButton />
  </View>
);

/** null while the flag is still being read from AsyncStorage. */
function useWalkthroughSeen(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    hasSeenWalkthrough().then(value => {
      if (!cancelled) {
        setSeen(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return seen;
}

export default function RootNavigator() {
  const { session, initializing } = useAuth();
  const walkthroughSeen = useWalkthroughSeen();

  if (initializing || walkthroughSeen === null) {
    return <LoadingView />;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '800', fontSize: 22, color: colors.text },
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {session ? (
          <>
            {walkthroughSeen ? null : (
              <Stack.Screen
                name="Walkthrough"
                component={WalkthroughScreen}
                options={{ headerShown: false }}
              />
            )}
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{
                title: 'MPS Expense Tracker',
                // Full name fits beside Help + Settings at 18px.
                headerTitleStyle: { fontWeight: '800', fontSize: 18, color: colors.text },
                headerRight: renderDashboardRight,
              }}
            />
            {walkthroughSeen ? (
              <Stack.Screen
                name="Walkthrough"
                component={WalkthroughScreen}
                options={{ headerShown: false, presentation: 'modal' }}
              />
            ) : null}
            <Stack.Screen
              name="ExpenseForm"
              component={ExpenseFormScreen}
              options={({ route }) => ({
                title: route.params?.kharchaId ? 'Edit' : 'Add',
              })}
            />
            <Stack.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{ title: 'Details' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: '⚙️ Settings' }}
            />
            <Stack.Screen
              name="ExpenseTypes"
              component={ExpenseTypesScreen}
              options={{ title: 'Expense types' }}
            />
            <Stack.Screen
              name="ExpenseTypeEdit"
              component={ExpenseTypeEditScreen}
              options={({ route }) => ({
                title: route.params?.category ? 'Edit type' : 'New type',
              })}
            />
            <Stack.Screen name="Staff" component={StaffScreen} options={{ title: 'Staff' }} />
            <Stack.Screen
              name="InviteStaff"
              component={InviteStaffScreen}
              options={{ title: 'Invite' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: '' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  headerIconButton: { minWidth: 44, alignItems: 'center' },
  headerIcon: { fontSize: 22 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
