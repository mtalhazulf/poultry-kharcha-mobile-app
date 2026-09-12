import React, { useCallback, useState } from 'react';
import { updateMyProfile } from '../../api/profiles';
import { useAuth } from '../../context/AuthProvider';
import { AppError } from '../../lib/errors';
import { Button, ErrorBanner, Sheet, TextField } from '../../ui';

export interface EditNameSheetProps {
  visible: boolean;
  /** Current display name ('' when none). */
  initialName: string;
  email: string;
  onClose: () => void;
}

const noop = () => undefined;

/** Bottom sheet to change the signed-in person's display name. */
export function EditNameSheet({ visible, initialName, email, onClose }: EditNameSheetProps) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  // Start from the saved name every time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(initialName);
      setError(null);
    }
  }

  const save = useCallback(async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile({ display_name: name });
      // The name is saved; a failed reload only delays the new name on screen.
      await refreshProfile().catch(noop);
      onClose();
    } catch (err) {
      setError(AppError.from(err));
    } finally {
      setSaving(false);
    }
  }, [name, onClose, refreshProfile, saving]);

  const fieldError = error?.kind === 'validation' ? error.message : null;

  return (
    <Sheet
      visible={visible}
      onClose={saving ? noop : onClose}
      dismissible={!saving}
      title="Your name"
      subtitle="People in your organizations see this name."
      footer={
        <Button title="Save" onPress={save} loading={saving} fullWidth testID="settings-name-save" />
      }
      testID="settings-name-sheet"
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={text => {
          setName(text);
          if (error) {
            setError(null);
          }
        }}
        placeholder={email}
        helperText="Leave it empty to show your email instead."
        error={fieldError}
        autoFocus
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={80}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={save}
        editable={!saving}
        testID="settings-name-input"
      />
      {error && !fieldError ? <ErrorBanner message={error.message} kind={error.kind} /> : null}
    </Sheet>
  );
}
