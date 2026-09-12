import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  formatInviteCode,
  INVITE_CODE_LENGTH,
  isValidInviteCode,
  normalizeInviteCode,
} from '../api/organizations';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { spacing } from '../theme';
import { AppText, Button, ErrorBanner, IconTile, Screen, TextField } from '../ui';

type Props = RootStackScreenProps<'JoinOrg'>;

/**
 * Field value while typing or pasting: uppercase, A-Z/0-9 only, at most 8
 * characters, shown as XXXX-XXXX. The field has no `maxLength` on purpose —
 * the platform would truncate a paste (a whole share message, say) before this
 * ran, leaving the first nine characters of prose instead of the code.
 */
export function inviteCodeInputValue(text: string): string {
  return formatInviteCode(normalizeInviteCode(text).slice(0, INVITE_CODE_LENGTH));
}

/** Problem with a typed code before it is sent, or null. */
export function inviteCodeProblem(text: string): string | null {
  const normalized = normalizeInviteCode(text);
  if (normalized.length < INVITE_CODE_LENGTH) {
    return 'Enter the 8-character invite code.';
  }
  if (!isValidInviteCode(normalized)) {
    return 'Check the code. Invite codes do not use I, O, 0 or 1.';
  }
  return null;
}

/**
 * Sends a join request with an invite code. A new request is pending until an
 * admin approves it; an existing active membership switches straight to that
 * organization.
 */
export default function JoinOrgScreen({ navigation, route }: Props) {
  const { joinWithCode, switchOrg } = useOrg();

  const [code, setCode] = useState(() => inviteCodeInputValue(route.params?.code ?? ''));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Organization name once a request is pending. */
  const [requestedOrg, setRequestedOrg] = useState<string | null>(null);

  const onCodeChange = useCallback((text: string) => {
    setCode(inviteCodeInputValue(text));
    setFieldError(null);
  }, []);

  const onSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    const problem = inviteCodeProblem(code);
    setFieldError(problem);
    if (problem) {
      return;
    }
    setError(null);
    setSubmitting(true);
    let joined = false;
    try {
      const result = await joinWithCode(code);
      if (result.status === 'pending') {
        setRequestedOrg(result.orgName);
      } else if (result.status === 'active') {
        await switchOrg(result.orgId);
        joined = true;
      } else {
        setError(
          new AppError(
            'permission',
            `Your access to ${result.orgName} is turned off. Ask an admin to turn it back on.`,
          ),
        );
      }
    } catch (err) {
      const appError = AppError.from(err);
      // Server sentences ("Invite code not found") are shown as they are.
      if (appError.kind === 'validation' || appError.kind === 'not_found') {
        setFieldError(appError.message);
      } else {
        setError(appError);
      }
    }
    // During setup the navigator moves to the main app by itself; opened from
    // the org switcher this screen goes back to the tabs. The route names are
    // read after the await because the stage may have changed meanwhile.
    if (joined && navigation.getState().routeNames.includes('Tabs')) {
      navigation.popTo('Tabs', { screen: 'ExpensesTab' });
    }
    // Never leave the button spinning: the screen may well still be mounted.
    setSubmitting(false);
  }, [submitting, code, navigation, joinWithCode, switchOrg]);

  /** "Request sent" has nothing behind it during setup: fall back to the welcome screen. */
  const onDone = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const { routeNames } = navigation.getState();
    if (routeNames.includes('Tabs')) {
      navigation.navigate('Tabs', { screen: 'ExpensesTab' });
    } else if (routeNames.includes('OrgWelcome')) {
      navigation.navigate('OrgWelcome');
    }
  }, [navigation]);

  if (requestedOrg !== null) {
    return (
      <Screen
        gap={spacing.xxl}
        contentStyle={styles.result}
        footer={<Button title="Done" onPress={onDone} fullWidth testID="join-org-done" />}
        testID="join-org-requested"
      >
        <IconTile icon="hourglass" tone="primary" size="lg" />
        <View style={styles.resultText}>
          <AppText variant="title" align="center" accessibilityRole="header">
            Request sent
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            An admin of {requestedOrg} needs to approve your request.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      footer={
        <Button
          title="Send request"
          onPress={onSubmit}
          loading={submitting}
          fullWidth
          testID="join-org-submit"
        />
      }
      testID="join-org"
    >
      <AppText variant="body" color="textSecondary">
        Your request goes to the organization's admins. You can see its expenses once they approve
        it.
      </AppText>

      <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />

      <TextField
        label="Invite code"
        autoFocus
        value={code}
        onChangeText={onCodeChange}
        error={fieldError}
        helperText="Ask an admin of the organization for the 8-character code."
        placeholder="XXXX-XXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        importantForAutofill="no"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        inputStyle={styles.codeInput}
        testID="join-org-code"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: { letterSpacing: 1, fontVariant: ['tabular-nums'] },
  result: { alignItems: 'center', justifyContent: 'center' },
  resultText: { gap: spacing.sm, maxWidth: 360 },
});
