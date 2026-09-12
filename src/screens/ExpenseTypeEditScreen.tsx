/**
 * Add or edit one expense type (admins). The preview shows the tile as it
 * appears in pickers and lists. Visibility is saved with the rest of the form.
 * The database enforces admin-only writes and unique names; its messages
 * (for example a duplicate name) are shown on the field.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { addCategory, removeCategory, updateCategory } from '../api/categories';
import { IconChoiceGrid } from '../components/settings/IconChoiceGrid';
import { useOrg } from '../context/OrgProvider';
import { useCategories } from '../hooks/useCategories';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { spacing } from '../theme';
import { categoryTint, iconForCategory, type CategoryIconName } from '../theme/categories';
import type { Category } from '../types/models';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  IconTile,
  ListGroup,
  ListItem,
  LoadingView,
  Screen,
  SectionHeader,
  TextField,
  Toggle,
} from '../ui';

type Props = RootStackScreenProps<'ExpenseTypeEdit'>;
type Busy = 'save' | 'remove';

interface Draft {
  name: string;
  icon: CategoryIconName;
  active: boolean;
}

const NEW_DRAFT: Draft = { name: '', icon: 'package', active: true };

function draftFrom(category: Category): Draft {
  return {
    name: category.name,
    icon: iconForCategory(category.name, category.icon),
    active: category.active,
  };
}

export default function ExpenseTypeEditScreen({ navigation, route }: Props) {
  const categoryId = route.params?.categoryId;
  const editing = categoryId !== undefined;
  const { activeOrg, isAdmin } = useOrg();
  const orgId = activeOrg?.id ?? null;
  // Only an existing type needs the list (hidden types included).
  const {
    categories,
    loading,
    error: loadError,
    refresh,
  } = useCategories(editing ? orgId : null, { includeInactive: true });
  const existing = editing ? categories.find(category => category.id === categoryId) ?? null : null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const form: Draft = draft ?? (existing ? draftFrom(existing) : NEW_DRAFT);
  const locked = !isAdmin || busy !== null;

  const update = useCallback(
    (patch: Partial<Draft>) => setDraft(current => ({ ...(current ?? form), ...patch })),
    [form],
  );

  const save = useCallback(async () => {
    if (!orgId || !isAdmin || busy) {
      return;
    }
    const name = form.name.trim();
    if (!name) {
      setNameError('Enter a name for this expense type.');
      return;
    }
    setBusy('save');
    setError(null);
    setNameError(null);
    try {
      if (existing) {
        const patch: { name?: string; icon?: string; active?: boolean } = {};
        if (name !== existing.name) {
          patch.name = name;
        }
        if (form.icon !== existing.icon) {
          patch.icon = form.icon;
        }
        if (form.active !== existing.active) {
          patch.active = form.active;
        }
        await updateCategory(existing.id, patch);
      } else {
        await addCategory(orgId, { name, icon: form.icon });
      }
      if (mounted.current) {
        navigation.goBack();
      }
    } catch (err) {
      if (!mounted.current) {
        return;
      }
      const appErr = AppError.from(err);
      if (appErr.kind === 'validation') {
        setNameError(appErr.message);
      } else {
        setError(appErr);
      }
      setBusy(null);
    }
  }, [orgId, isAdmin, busy, form, existing, navigation]);

  const remove = useCallback(
    async (id: string) => {
      setBusy('remove');
      setError(null);
      try {
        await removeCategory(id);
        if (mounted.current) {
          navigation.goBack();
        }
      } catch (err) {
        if (mounted.current) {
          setError(AppError.from(err));
          setBusy(null);
        }
      }
    },
    [navigation],
  );

  const confirmRemove = useCallback(() => {
    if (!existing || busy) {
      return;
    }
    Alert.alert(
      `Remove ${existing.name}?`,
      'Past expenses keep this type name and icon. To keep it for later, hide it instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            remove(existing.id);
          },
        },
      ],
    );
  }, [existing, busy, remove]);

  if (editing && !existing) {
    if (loading) {
      return (
        <Screen testID="type-edit">
          <LoadingView message="Loading expense type" />
        </Screen>
      );
    }
    return (
      <Screen gap={spacing.xxl} testID="type-edit">
        {loadError ? (
          <ErrorBanner
            message={loadError.message}
            kind={loadError.kind}
            onRetry={() => {
              refresh();
            }}
          />
        ) : (
          <EmptyState
            fill
            icon="list"
            title="This expense type is gone"
            message="Someone may have removed it."
            action={{ label: 'Back to expense types', onPress: () => navigation.goBack() }}
          />
        )}
      </Screen>
    );
  }

  const trimmedName = form.name.trim();

  return (
    <Screen
      keyboard
      gap={spacing.xxl}
      footer={
        isAdmin ? (
          <Button
            title="Save"
            onPress={save}
            loading={busy === 'save'}
            disabled={busy !== null}
            fullWidth
            testID="type-save"
          />
        ) : undefined
      }
      testID="type-edit"
    >
      {isAdmin ? null : <Banner tone="info" icon="lock" message="Only an admin can change these" />}
      <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />

      <Card
        style={styles.preview}
        accessible
        accessibilityLabel={`Preview, ${trimmedName || 'New expense type'}`}
      >
        <IconTile icon={form.icon} tint={categoryTint(trimmedName || 'New type')} size="lg" />
        <AppText
          variant="headline"
          color={trimmedName ? 'text' : 'textTertiary'}
          numberOfLines={1}
          style={styles.previewName}
        >
          {trimmedName || 'New expense type'}
        </AppText>
        {existing && !form.active ? <Badge label="Hidden" tone="neutral" /> : null}
      </Card>

      <TextField
        label="Name"
        value={form.name}
        onChangeText={text => {
          update({ name: text });
          if (nameError) {
            setNameError(null);
          }
        }}
        placeholder="For example, Feed"
        autoFocus={!editing}
        autoCapitalize="words"
        maxLength={40}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={save}
        error={nameError}
        editable={!locked}
        testID="type-name"
      />

      <View style={styles.section}>
        <SectionHeader title="Icon" />
        <IconChoiceGrid value={form.icon} onChange={icon => update({ icon })} disabled={locked} />
      </View>

      {existing ? (
        <>
          <ListGroup>
            <ListItem
              title="Visible in lists"
              subtitle={
                form.active
                  ? 'People can pick this type for new expenses.'
                  : 'Hidden from new expenses. Past expenses keep it.'
              }
              subtitleLines={2}
              trailing={
                <Toggle
                  value={form.active}
                  onValueChange={active => update({ active })}
                  disabled={locked}
                  accessibilityLabel="Visible in lists"
                  testID="type-visible"
                />
              }
            />
          </ListGroup>
          {isAdmin ? (
            <Button
              title="Remove type"
              icon="trash"
              variant="danger"
              onPress={confirmRemove}
              loading={busy === 'remove'}
              disabled={busy !== null}
              testID="type-remove"
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewName: { flex: 1 },
  section: { gap: spacing.sm },
});
