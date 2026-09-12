import React, { useCallback, useState } from 'react';
import { validateOrganizationName } from '../api/organizations';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { AppText, Button, ErrorBanner, Screen, TextField } from '../ui';

type Props = RootStackScreenProps<'CreateOrg'>;

/**
 * Creates an organization and makes it the active one. During setup the
 * navigator moves to the main app by itself; from the org switcher (inside
 * the app) this screen goes back to the tabs.
 */
export default function CreateOrgScreen({ navigation }: Props) {
  const { createOrg } = useOrg();

  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onNameChange = useCallback((text: string) => {
    setName(text);
    setFieldError(null);
  }, []);

  const onSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    const problem = validateOrganizationName(name);
    setFieldError(problem);
    if (problem) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createOrg(name);
    } catch (err) {
      const appError = AppError.from(err);
      if (appError.kind === 'validation') {
        setFieldError(appError.message);
      } else {
        setError(appError);
      }
      setSubmitting(false);
      return;
    }
    // During setup the navigator moves to the main app by itself; opened from
    // the org switcher this screen goes back to the tabs. The route names are
    // read after the await because the stage may have changed meanwhile.
    if (navigation.getState().routeNames.includes('Tabs')) {
      navigation.popTo('Tabs', { screen: 'ExpensesTab' });
    }
    // Never leave the button spinning: the screen may well still be mounted.
    setSubmitting(false);
  }, [submitting, name, navigation, createOrg]);

  return (
    <Screen
      keyboard
      footer={
        <Button
          title="Create organization"
          onPress={onSubmit}
          loading={submitting}
          fullWidth
          testID="create-org-submit"
        />
      }
      testID="create-org"
    >
      <AppText variant="body" color="textSecondary">
        You will be the owner. Invite your team with a code once it is created.
      </AppText>

      <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />

      <TextField
        label="Organization name"
        autoFocus
        value={name}
        onChangeText={onNameChange}
        error={fieldError}
        helperText="You can change this later."
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={80}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        testID="create-org-name"
      />
    </Screen>
  );
}
