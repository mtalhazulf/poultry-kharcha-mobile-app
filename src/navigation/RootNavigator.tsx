import {
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
  type LinkingOptions,
  type RouteProp,
  type Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthProvider';
import { useBiometricLock } from '../context/BiometricLockProvider';
import { useOrg } from '../context/OrgProvider';
import { hasSeenWalkthrough, subscribeWalkthroughSeen } from '../lib/walkthrough';
import { setPendingDeepLink, takePendingDeepLink } from '../lib/pendingDeepLink';
import CreateOrgScreen from '../screens/CreateOrgScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import ExpenseTypeEditScreen from '../screens/ExpenseTypeEditScreen';
import ExpenseTypesScreen from '../screens/ExpenseTypesScreen';
import JoinOrgScreen from '../screens/JoinOrgScreen';
import LockScreen from '../screens/LockScreen';
import LoginScreen from '../screens/LoginScreen';
import MemberDetailScreen from '../screens/MemberDetailScreen';
import PersonKhataScreen from '../screens/PersonKhataScreen';
import OrgSettingsScreen from '../screens/OrgSettingsScreen';
import OrgWelcomeScreen from '../screens/OrgWelcomeScreen';
import SignUpScreen from '../screens/SignUpScreen';
import TeamScreen from '../screens/TeamScreen';
import WalkthroughScreen from '../screens/WalkthroughScreen';
import { colors, typography } from '../theme';
import type { Membership } from '../types/models';
import { LoadingView } from '../ui';
import MainTabs from './MainTabs';
import { getRootStage } from './rootStage';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Auth callbacks (kharcha://auth/callback) are consumed by AuthProvider, not
// React Navigation, so no screen is mapped for that path. Expense links (e.g.
// from the home-screen widget) are; see the pending-deep-link handling below
// for why a cold start needs more than this config alone.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kharcha://'],
  config: {
    screens: {
      ExpenseForm: 'expense/new',
      ExpenseDetail: 'expense/:kharchaId',
    },
  },
};

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

/** Detail screen title size from the design spec (between headline and title). */
const HEADER_TITLE_SIZE = 17;

/** Detail screens: white bar without a shadow, semibold title, dark back chevron. */
const stackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontSize: HEADER_TITLE_SIZE,
    fontWeight: typography.headline.fontWeight,
    color: colors.text,
  },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.bg },
};

const NO_HEADER: NativeStackNavigationOptions = { headerShown: false };
const TABS_OPTIONS: NativeStackNavigationOptions = { headerShown: false, animation: 'fade' };
const LOCK_OPTIONS: NativeStackNavigationOptions = { headerShown: false, animation: 'fade' };
const CREATE_ORG_OPTIONS: NativeStackNavigationOptions = { title: 'Create organization' };
const JOIN_ORG_OPTIONS: NativeStackNavigationOptions = { title: 'Join organization' };

/** First run is a plain full screen before the tabs; a replay from Settings is a modal. */
function walkthroughOptions({
  route,
}: {
  route: RouteProp<RootStackParamList, 'Walkthrough'>;
}): NativeStackNavigationOptions {
  const replay = route.params?.replay === true;
  return {
    headerShown: false,
    presentation: replay ? 'modal' : 'card',
    animation: replay ? 'slide_from_bottom' : 'fade',
  };
}

function expenseFormOptions({
  route,
}: {
  route: RouteProp<RootStackParamList, 'ExpenseForm'>;
}): NativeStackNavigationOptions {
  return { title: route.params?.kharchaId ? 'Edit expense' : 'New expense' };
}

function expenseTypeEditOptions({
  route,
}: {
  route: RouteProp<RootStackParamList, 'ExpenseTypeEdit'>;
}): NativeStackNavigationOptions {
  return { title: route.params?.categoryId ? 'Edit type' : 'New type' };
}

/**
 * True once OrgProvider has started loading memberships for `userId`. Right
 * after sign-in the provider still reports the signed-out state (not loading,
 * no memberships) for a render; without this the welcome screen would flash.
 */
function useOrgStarted(userId: string | null, loading: boolean, memberships: Membership[]): boolean {
  const [startedFor, setStartedFor] = useState<string | null>(null);
  if (userId === null) {
    if (startedFor !== null) {
      setStartedFor(null);
    }
  } else if (loading && startedFor !== userId) {
    setStartedFor(userId);
  }
  return (
    userId !== null &&
    (loading || startedFor === userId || memberships.some(m => m.user_id === userId))
  );
}

/** The signed-in user's walkthrough flag; null while it is being read. */
function useWalkthroughSeen(userId: string | null): boolean | null {
  const [state, setState] = useState<{ userId: string; seen: boolean } | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    const unsubscribe = subscribeWalkthroughSeen(id => {
      if (active && id === userId) {
        setState({ userId, seen: true });
      }
    });
    hasSeenWalkthrough(userId).then(seen => {
      if (active) {
        // A "seen" from the subscription wins over a read that started before it.
        setState(prev => (prev?.userId === userId && prev.seen ? prev : { userId, seen }));
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  return state !== null && state.userId === userId ? state.seen : null;
}

/**
 * Gating (docs/ARCHITECTURE.md §5): session → biometric lock → organization →
 * main app. Each stage mounts its own screens; the navigator resets to the
 * first screen of a stage when the stage changes.
 *
 * Every stage is a `Stack.Group` with its own `navigationKey`. CreateOrg and
 * JoinOrg exist in both the org and the app stage, and the stack router keeps a
 * route whose name still exists after a stage change — without the key, someone
 * who finishes setup would be left sitting on the form with nothing behind it.
 * A changed navigationKey evicts the stale route instead.
 */
export default function RootNavigator() {
  const { session, user, initializing } = useAuth();
  const { locked, ready: lockReady } = useBiometricLock();
  const { activeOrg, memberships, loading: orgLoading } = useOrg();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const userId = user?.id ?? null;
  const orgStarted = useOrgStarted(userId, orgLoading, memberships);
  const walkthroughSeen = useWalkthroughSeen(userId);

  const stage = getRootStage({
    initializing,
    signedIn: session !== null,
    lockReady,
    locked,
    orgStarted,
    orgLoading,
    membershipCount: memberships.length,
    hasActiveOrg: activeOrg !== null,
    walkthroughSeen,
  });

  // Captured independently of AuthProvider's own listener (which only acts on
  // the auth-callback path): a non-auth URL is held until the `app` stage can
  // receive it, since ExpenseForm/ExpenseDetail don't exist in any other stage.
  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL()
      .then(url => {
        if (url && !cancelled) {
          setPendingDeepLink(url);
        }
      })
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => setPendingDeepLink(url));
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (stage !== 'app') {
      return;
    }
    const link = takePendingDeepLink();
    if (!link) {
      return;
    }
    if (link.screen === 'ExpenseForm') {
      navigationRef.navigate('ExpenseForm');
    } else {
      navigationRef.navigate('ExpenseDetail', { kharchaId: link.kharchaId });
    }
  }, [stage, navigationRef]);

  if (stage === 'splash') {
    return <LoadingView style={styles.splash} testID="app-splash" />;
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={navigationTheme}>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        {stage === 'auth' ? (
          <Stack.Group navigationKey="auth">
            <Stack.Screen name="Login" component={LoginScreen} options={NO_HEADER} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={NO_HEADER} />
          </Stack.Group>
        ) : null}

        {stage === 'lock' ? (
          <Stack.Group navigationKey="lock">
            <Stack.Screen name="Lock" component={LockScreen} options={LOCK_OPTIONS} />
          </Stack.Group>
        ) : null}

        {stage === 'org' ? (
          <Stack.Group navigationKey="org">
            <Stack.Screen name="OrgWelcome" component={OrgWelcomeScreen} options={NO_HEADER} />
            <Stack.Screen name="CreateOrg" component={CreateOrgScreen} options={CREATE_ORG_OPTIONS} />
            <Stack.Screen name="JoinOrg" component={JoinOrgScreen} options={JOIN_ORG_OPTIONS} />
          </Stack.Group>
        ) : null}

        {stage === 'app' ? (
          <Stack.Group navigationKey="app">
            {/* Listed first only for a new user, so it becomes the initial screen. */}
            {walkthroughSeen ? null : (
              <Stack.Screen
                name="Walkthrough"
                component={WalkthroughScreen}
                options={walkthroughOptions}
              />
            )}
            <Stack.Screen name="Tabs" component={MainTabs} options={TABS_OPTIONS} />
            <Stack.Screen
              name="ExpenseForm"
              component={ExpenseFormScreen}
              options={expenseFormOptions}
            />
            <Stack.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{ title: 'Expense' }}
            />
            <Stack.Screen
              name="ExpenseTypes"
              component={ExpenseTypesScreen}
              options={{ title: 'Expense types' }}
            />
            <Stack.Screen
              name="ExpenseTypeEdit"
              component={ExpenseTypeEditScreen}
              options={expenseTypeEditOptions}
            />
            <Stack.Screen
              name="OrgSettings"
              component={OrgSettingsScreen}
              options={{ title: 'Organization' }}
            />
            <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
            <Stack.Screen
              name="MemberDetail"
              component={MemberDetailScreen}
              options={{ title: 'Member' }}
            />
            <Stack.Screen
              name="PersonKhata"
              component={PersonKhataScreen}
              options={{ title: 'Khata' }}
            />
            <Stack.Screen name="CreateOrg" component={CreateOrgScreen} options={CREATE_ORG_OPTIONS} />
            <Stack.Screen name="JoinOrg" component={JoinOrgScreen} options={JOIN_ORG_OPTIONS} />
            {walkthroughSeen ? (
              <Stack.Screen
                name="Walkthrough"
                component={WalkthroughScreen}
                options={walkthroughOptions}
              />
            ) : null}
          </Stack.Group>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { backgroundColor: colors.bg },
});
