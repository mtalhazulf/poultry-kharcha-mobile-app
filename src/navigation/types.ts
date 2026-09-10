import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
