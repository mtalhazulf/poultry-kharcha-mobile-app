import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Category } from '../types/models';

/**
 * Single root stack. The navigator mounts the auth screens when there is no
 * session and the app screens when there is, so a screen never needs to
 * guard against being reached unauthenticated.
 */
export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  /** First-run tour; `replay` when opened from the Help button. */
  Walkthrough: { replay?: boolean } | undefined;
  Dashboard: undefined;
  /** Omit `kharchaId` to create; pass it to edit (owner only). */
  ExpenseForm: { kharchaId?: string } | undefined;
  ExpenseDetail: { kharchaId: string };
  Settings: undefined;
  /** The org's expense types; admins can open one to edit it. */
  ExpenseTypes: undefined;
  /** Omit `category` to add a new type (admins only). */
  ExpenseTypeEdit: { category?: Category } | undefined;
  /** Admins: invites, accounts and roles. */
  Staff: undefined;
  InviteStaff: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
