import { NavigationContainer, useNavigation, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LoadingView } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import { hasSeenWalkthrough } from '../lib/walkthrough';
import DashboardScreen from '../screens/DashboardScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
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

function SignOutButton() {
  const { signOut } = useAuth();
  const onPress = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut().catch(err => {
            Alert.alert('Could not sign out', AppError.from(err).message);
          });
        },
      },
    ]);
  }, [signOut]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      onPress={onPress}
      hitSlop={8}
      style={styles.headerButton}
    >
      <Text style={styles.headerButtonText}>🚪 Sign out</Text>
    </Pressable>
  );
}

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

const renderDashboardRight = () => (
  <View style={styles.headerRight}>
    <HelpButton />
    <SignOutButton />
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
              options={{ title: '💰 Kharcha', headerRight: renderDashboardRight }}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
