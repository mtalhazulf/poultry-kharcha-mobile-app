import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { LoadingView } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import DashboardScreen from '../screens/DashboardScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
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
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.headerButton}>
      <Text style={styles.headerButtonText}>Sign out</Text>
    </Pressable>
  );
}

const renderSignOut = () => <SignOutButton />;

export default function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return <LoadingView />;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700' },
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {session ? (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ title: 'Kharcha', headerRight: renderSignOut }}
            />
            <Stack.Screen
              name="ExpenseForm"
              component={ExpenseFormScreen}
              options={({ route }) => ({
                title: route.params?.kharchaId ? 'Edit expense' : 'Add expense',
              })}
            />
            <Stack.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{ title: 'Expense' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="SignUp"
              component={SignUpScreen}
              options={{ title: 'Create account' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  headerButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});
