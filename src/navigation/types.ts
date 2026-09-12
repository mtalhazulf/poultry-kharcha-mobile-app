import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Bottom tabs rendered by the root stack's `Tabs` screen (docs/ARCHITECTURE.md §5). */
export type MainTabParamList = {
  ExpensesTab: undefined;
  ReportsTab: undefined;
  SettingsTab: undefined;
};

/**
 * Single root stack. RootNavigator mounts one group of screens per stage
 * (signed out, locked, no organization, main app), so a screen never needs
 * to guard against being reached in the wrong state.
 */
export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  /** Biometric lock; shown instead of the app while `useBiometricLock().locked`. */
  Lock: undefined;
  /** No active organization yet: create one or join with a code. */
  OrgWelcome: undefined;
  CreateOrg: undefined;
  /** `code` prefills the invite code field. */
  JoinOrg: { code?: string } | undefined;
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  /** Omit `kharchaId` to create; pass it to edit (owner only). */
  ExpenseForm: { kharchaId?: string } | undefined;
  ExpenseDetail: { kharchaId: string };
  ExpenseTypes: undefined;
  /** Omit `categoryId` to add a new type (admins only). */
  ExpenseTypeEdit: { categoryId?: string } | undefined;
  OrgSettings: undefined;
  Team: undefined;
  MemberDetail: { userId: string };
  /** First-run tour; `replay` when opened again from Settings (shown as a modal). */
  Walkthrough: { replay?: boolean } | undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/** Props of a tab screen: tab navigation plus the parent stack (`navigation.navigate('ExpenseForm')`). */
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
