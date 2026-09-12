import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { act } from 'react';
import { AppState, Text, TextInput, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TestRenderer, { type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AppHeader } from '../src/components/AppHeader';
import { useAuth } from '../src/context/AuthProvider';
import { useBiometricLock } from '../src/context/BiometricLockProvider';
import { useOrg } from '../src/context/OrgProvider';
import { AppError } from '../src/lib/errors';
import { walkthroughStorageKey } from '../src/lib/walkthrough';
import type { MainTabParamList, MainTabScreenProps } from '../src/navigation/types';
import JoinOrgScreen from '../src/screens/JoinOrgScreen';
import LockScreen from '../src/screens/LockScreen';
import LoginScreen from '../src/screens/LoginScreen';
import WalkthroughScreen from '../src/screens/WalkthroughScreen';

jest.mock('../src/context/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/context/OrgProvider', () => ({ useOrg: jest.fn() }));
jest.mock('../src/context/BiometricLockProvider', () => ({ useBiometricLock: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
  requireUserId: jest.fn(async () => '00000000-0000-4000-8000-000000000001'),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseOrg = useOrg as jest.MockedFunction<typeof useOrg>;
const mockedUseLock = useBiometricLock as jest.MockedFunction<typeof useBiometricLock>;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

let renderer: ReactTestRenderer | null = null;

async function render(node: React.ReactElement): Promise<ReactTestRenderer> {
  let created: ReactTestRenderer | null = null;
  await act(async () => {
    created = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>,
      { createNodeMock: () => ({ focus: jest.fn(), scrollToOffset: jest.fn(), scrollTo: jest.fn() }) },
    );
  });
  if (!created) {
    throw new Error('render failed');
  }
  renderer = created;
  return created;
}

afterEach(async () => {
  if (renderer) {
    const r = renderer;
    renderer = null;
    await act(async () => r.unmount());
  }
  jest.clearAllMocks();
});

function text(r: ReactTestRenderer): string {
  return JSON.stringify(r.toJSON());
}

function input(r: ReactTestRenderer, testID: string): ReactTestInstance {
  const found = r.root.findAllByType(TextInput).find(node => node.props.testID === testID);
  if (!found) {
    throw new Error(`No input ${testID}`);
  }
  return found;
}

/** The pressable composite behind a testID (Button/ListItem/Pressable all forward onPress). */
function pressable(r: ReactTestRenderer, testID: string): ReactTestInstance {
  const found = r.root.findAll(
    node => node.props.testID === testID && typeof node.props.onPress === 'function',
  )[0];
  if (!found) {
    throw new Error(`No pressable ${testID}`);
  }
  return found;
}

async function press(r: ReactTestRenderer, testID: string) {
  await act(async () => {
    await pressable(r, testID).props.onPress();
  });
}

async function type(r: ReactTestRenderer, testID: string, value: string) {
  await act(async () => {
    input(r, testID).props.onChangeText(value);
  });
}

function makeNavigation(routeNames: string[]) {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
    replace: jest.fn(),
    popTo: jest.fn(),
    getState: jest.fn(() => ({ routeNames })),
  };
}

function setAuth(patch: Partial<ReturnType<typeof useAuth>> = {}) {
  mockedUseAuth.mockReturnValue({
    session: null,
    user: { id: 'user-1', email: 'sana@example.com' },
    profile: null,
    initializing: false,
    lastAuthError: null,
    clearAuthError: jest.fn(),
    signInWithPassword: jest.fn(async () => undefined),
    signUpWithPassword: jest.fn(async () => ({ needsEmailConfirmation: false })),
    signInWithGoogle: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshProfile: jest.fn(async () => undefined),
    ...patch,
  } as unknown as ReturnType<typeof useAuth>);
}

function setOrg(patch: Partial<ReturnType<typeof useOrg>> = {}) {
  mockedUseOrg.mockReturnValue({
    memberships: [],
    activeMemberships: [],
    pendingMemberships: [],
    activeOrg: null,
    role: null,
    isAdmin: false,
    isOwner: false,
    loading: false,
    error: null,
    switchOrg: jest.fn(async () => undefined),
    refresh: jest.fn(async () => undefined),
    createOrg: jest.fn(),
    joinWithCode: jest.fn(),
    ...patch,
  } as unknown as ReturnType<typeof useOrg>);
}

describe('LoginScreen', () => {
  it('keeps the smoke-test ids and validates before signing in', async () => {
    const signInWithPassword = jest.fn(async () => undefined);
    setAuth({ signInWithPassword });
    const navigation = makeNavigation(['Login', 'SignUp']);
    const r = await render(<LoginScreen navigation={navigation as never} route={{} as never} />);

    expect(text(r)).toContain('MPS Expense Tracker');
    expect(input(r, 'login-email').props.returnKeyType).toBe('next');
    expect(input(r, 'login-password').props.returnKeyType).toBe('go');

    await press(r, 'login-submit');
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(text(r)).toContain('Email is required.');
    expect(text(r)).toContain('Enter your password.');

    await type(r, 'login-email', 'sana@example.com');
    await type(r, 'login-password', 'secret');
    await press(r, 'login-submit');
    expect(signInWithPassword).toHaveBeenCalledWith('sana@example.com', 'secret');
  });

  it('rewrites the wrong-password message', async () => {
    setAuth({
      signInWithPassword: jest.fn(async () => {
        throw new AppError('auth', 'Invalid login credentials');
      }),
    });
    const r = await render(
      <LoginScreen navigation={makeNavigation([]) as never} route={{} as never} />,
    );
    await type(r, 'login-email', 'sana@example.com');
    await type(r, 'login-password', 'wrong');
    await press(r, 'login-submit');
    expect(text(r)).toContain('Incorrect email or password.');
  });
});

describe('LockScreen', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    appStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateListener = handler as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prompts once, shows a quiet failure, and signs out for password sign-in', async () => {
    const unlock = jest.fn(async () => false);
    const signOut = jest.fn(async () => undefined);
    setAuth({ signOut });
    mockedUseLock.mockReturnValue({
      available: true,
      biometryLabel: 'Fingerprint',
      enabled: true,
      locked: true,
      ready: true,
      enable: jest.fn(),
      disable: jest.fn(),
      unlock,
      suspendRelock: jest.fn(task => task()),
    });

    const r = await render(<LockScreen />);
    await act(async () => appStateListener?.('active'));
    await act(async () => appStateListener?.('active'));

    expect(unlock).toHaveBeenCalledTimes(1);
    expect(text(r)).toContain('Locked');
    expect(text(r)).toContain('fingerprint');
    expect(text(r)).toContain('Not unlocked. Try again, or sign in with your password.');

    await press(r, 'lock-use-password');
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('WalkthroughScreen', () => {
  it('walks four slides, then opens the tabs and remembers the user', async () => {
    setAuth({ user: { id: 'walk-user' } as never });
    const navigation = makeNavigation(['Walkthrough', 'Tabs']);
    const r = await render(
      <WalkthroughScreen navigation={navigation as never} route={{ params: undefined } as never} />,
    );

    for (let i = 0; i < 3; i += 1) {
      expect(text(r)).toContain('"Next"');
      await press(r, 'walkthrough-next');
    }
    expect(text(r)).toContain('Get started');
    expect(r.root.findAll(node => node.props.testID === 'walkthrough-skip')).toHaveLength(0);

    await press(r, 'walkthrough-next');
    expect(navigation.replace).toHaveBeenCalledWith('Tabs');
    expect(await AsyncStorage.getItem(walkthroughStorageKey('walk-user'))).toBe('done');
  });

  it('closes the modal on skip when replayed from Settings', async () => {
    setAuth({ user: { id: 'replay-user' } as never });
    const navigation = makeNavigation(['Tabs', 'Walkthrough']);
    const r = await render(
      <WalkthroughScreen
        navigation={navigation as never}
        route={{ params: { replay: true } } as never}
      />,
    );
    await press(r, 'walkthrough-skip');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe('JoinOrgScreen', () => {
  it('prefills and formats the code, then shows the pending state', async () => {
    const joinWithCode = jest.fn(async () => ({ orgId: 'org-1', orgName: 'MPS', status: 'pending' }));
    setOrg({ joinWithCode } as never);
    const navigation = makeNavigation(['OrgWelcome', 'CreateOrg', 'JoinOrg']);
    const r = await render(
      <JoinOrgScreen navigation={navigation as never} route={{ params: { code: 'k7px' } } as never} />,
    );

    expect(input(r, 'join-org-code').props.value).toBe('K7PX');
    // No maxLength: the platform truncates a paste before onChangeText, so a
    // code pasted with a space in front of it would arrive one character short.
    expect(input(r, 'join-org-code').props.maxLength).toBeUndefined();
    await type(r, 'join-org-code', ' K7PX-3MQ9 ');
    expect(input(r, 'join-org-code').props.value).toBe('K7PX-3MQ9');
    await type(r, 'join-org-code', 'k7px3mq9');
    expect(input(r, 'join-org-code').props.value).toBe('K7PX-3MQ9');

    await press(r, 'join-org-submit');
    expect(joinWithCode).toHaveBeenCalledWith('K7PX-3MQ9');
    expect(text(r)).toContain('Request sent');
    expect(text(r)).toContain('MPS');

    await press(r, 'join-org-done');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('switches to an organization that is already active and returns to the tabs', async () => {
    const switchOrg = jest.fn(async () => undefined);
    const joinWithCode = jest.fn(async () => ({ orgId: 'org-2', orgName: 'Farm B', status: 'active' }));
    setOrg({ joinWithCode, switchOrg } as never);
    const navigation = makeNavigation(['Tabs', 'CreateOrg', 'JoinOrg']);
    const r = await render(
      <JoinOrgScreen navigation={navigation as never} route={{ params: undefined } as never} />,
    );
    await type(r, 'join-org-code', 'K7PX-3MQ9');
    await press(r, 'join-org-submit');
    expect(switchOrg).toHaveBeenCalledWith('org-2');
    expect(navigation.popTo).toHaveBeenCalledWith('Tabs', { screen: 'ExpensesTab' });
  });

  it('shows the server sentence for an unknown code', async () => {
    const joinWithCode = jest.fn(async () => {
      throw new AppError('not_found', 'Invite code not found');
    });
    setOrg({ joinWithCode } as never);
    const r = await render(
      <JoinOrgScreen navigation={makeNavigation([]) as never} route={{ params: undefined } as never} />,
    );
    await type(r, 'join-org-code', 'K7PX-3MQ9');
    await press(r, 'join-org-submit');
    expect(text(r)).toContain('Invite code not found');
  });
});

describe('AppHeader', () => {
  it('opens the org switcher and routes to create organization', async () => {
    const organization = { id: 'org-1', name: 'MPS', currency: 'PKR', created_at: '2026-01-01' };
    const membership = {
      org_id: 'org-1',
      user_id: 'user-1',
      role: 'owner',
      status: 'active',
      requested_at: '2026-01-01T00:00:00Z',
      approved_at: null,
      organization,
    };
    setOrg({ activeOrg: organization, memberships: [membership], activeMemberships: [membership] } as never);

    const r = await render(<AppHeader right={<Text>Actions</Text>} />);
    const switcher = pressable(r, 'org-switcher');
    expect(switcher.props.accessibilityLabel).toBe('MPS. Switch organization');
    expect(text(r)).toContain('Actions');

    await press(r, 'org-switcher');
    expect(text(r)).toContain('Organizations');
    expect(text(r)).toContain('Owner');

    await press(r, 'org-switcher-create');
    expect(mockNavigate).toHaveBeenCalledWith('CreateOrg');
  });
});

// Compile-time contract for the tab screens owned by other engineers.
const ContractTabs = createBottomTabNavigator<MainTabParamList>();
function SettingsLike({ navigation }: MainTabScreenProps<'SettingsTab'>) {
  navigation.navigate('Walkthrough', { replay: true });
  return null;
}
function TabContract() {
  return (
    <ContractTabs.Navigator>
      <ContractTabs.Screen name="SettingsTab" component={SettingsLike} />
    </ContractTabs.Navigator>
  );
}

describe('navigation types', () => {
  it('accept tab screens typed with MainTabScreenProps', () => {
    expect(TabContract).toBeDefined();
  });
});
