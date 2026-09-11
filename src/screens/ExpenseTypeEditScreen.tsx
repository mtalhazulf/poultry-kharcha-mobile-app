/**
 * Add or change one expense type (admins). The big preview shows how the type
 * will look on the Add-expense screen. RLS rejects writes from anyone who is
 * not an admin; this screen is only linked from admin controls.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addCategory, removeCategory, updateCategory } from '../api/categories';
import { Button, ErrorBanner, IconCircle, TextField } from '../components/ui';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { EMOJI_CHOICES, categoryBg } from '../theme/categories';

type Props = RootStackScreenProps<'ExpenseTypeEdit'>;
type BusyAction = 'save' | 'toggle' | 'remove';

export default function ExpenseTypeEditScreen({ navigation, route }: Props) {
  const existing = route.params?.category;
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '📦');
  const [custom, setCustom] = useState(
    existing && !EMOJI_CHOICES.includes(existing.emoji) ? existing.emoji : '',
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const locked = busy !== null;

  /** Runs one write and leaves the screen on success; the list refreshes on focus. */
  const run = useCallback(
    async (kind: BusyAction, action: () => Promise<unknown>) => {
      setBusy(kind);
      setError(null);
      try {
        await action();
        navigation.goBack();
      } catch (err) {
        setError(AppError.from(err));
        setBusy(null);
      }
    },
    [navigation],
  );

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Type a name for this expense type.');
      return;
    }
    run('save', () =>
      existing
        ? updateCategory(existing.id, { name: trimmed, emoji })
        : addCategory({ name: trimmed, emoji }),
    );
  };

  const toggleHidden = () => {
    if (existing) {
      run('toggle', () => updateCategory(existing.id, { active: !existing.active }));
    }
  };

  const confirmRemove = () => {
    if (!existing) {
      return;
    }
    Alert.alert('Remove this type?', 'Old expenses keep their name and picture.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          run('remove', () => removeCategory(existing.id));
        },
      },
    ]);
  };

  const pickChoice = (choice: string) => {
    setEmoji(choice);
    setCustom('');
  };

  const typeCustom = (value: string) => {
    setCustom(value);
    const trimmed = value.trim();
    if (trimmed) {
      setEmoji(trimmed);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />

        <View style={styles.preview}>
          <IconCircle emoji={emoji} bg={categoryBg(name.trim() || 'new')} size={88} />
          <Text style={styles.previewName} numberOfLines={1}>
            {name.trim() || 'New type'}
          </Text>
        </View>

        <TextField
          label="Name"
          icon="✏️"
          placeholder="e.g. Feed"
          value={name}
          onChangeText={text => {
            setName(text);
            if (nameError) {
              setNameError(null);
            }
          }}
          autoCapitalize="words"
          maxLength={40}
          error={nameError}
          editable={!locked}
          testID="type-name"
        />

        <Text style={styles.label}>Picture</Text>
        <View style={styles.emojiGrid}>
          {EMOJI_CHOICES.map(choice => {
            const selected = emoji === choice;
            return (
              <Pressable
                key={choice}
                accessibilityRole="button"
                accessibilityLabel={`Picture ${choice}`}
                accessibilityState={{ selected }}
                onPress={() => pickChoice(choice)}
                disabled={locked}
                style={({ pressed }) => [
                  styles.emojiCell,
                  selected && styles.emojiCellSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emojiText}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextField
          icon="⌨️"
          placeholder="Or type any emoji"
          value={custom}
          onChangeText={typeCustom}
          maxLength={8}
          autoCorrect={false}
          editable={!locked}
        />

        {existing ? (
          <View style={styles.more}>
            <Text style={styles.label}>More</Text>
            <Button
              icon={existing.active ? '🙈' : '👁️'}
              title={existing.active ? 'Hide this type' : 'Show this type'}
              variant="secondary"
              loading={busy === 'toggle'}
              disabled={locked}
              onPress={toggleHidden}
            />
            <Text style={styles.caption}>
              {existing.active
                ? "Hidden types can't be picked for new expenses."
                : 'It will show on the Add screen again.'}
            </Text>
            <Button
              icon="🗑️"
              title="Remove type"
              variant="danger"
              loading={busy === 'remove'}
              disabled={locked}
              onPress={confirmRemove}
              style={styles.remove}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button
          size="lg"
          icon="✅"
          title={existing ? 'Save changes' : 'Add type'}
          loading={busy === 'save'}
          disabled={locked}
          onPress={save}
          testID="type-save"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  preview: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  previewName: { ...typography.heading },
  label: { ...typography.label, marginBottom: spacing.sm },
  caption: { ...typography.caption },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  emojiCell: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellSelected: {
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: 0.7 },
  emojiText: { fontSize: 28 },
  more: { gap: spacing.sm, marginTop: spacing.sm },
  remove: { marginTop: spacing.md },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
