/**
 * Settings: who you are, the org's expense types, staff (admins only), help
 * and sign-out. Every admin-only control here is cosmetic — the database's
 * RLS policies are the real gate, so hiding a button never grants or
 * removes any power; it just keeps the screen simple for members.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addCategory, removeCategory, updateCategory } from '../api/categories';
import {
  inviteMember,
  listMembers,
  listPendingInvites,
  revokeInvite,
  setMemberDisabled,
  setMemberRole,
} from '../api/staff';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  ErrorBanner,
  IconCircle,
  InfoBanner,
  LoadingView,
  Segmented,
  TextField,
  type SegmentOption,
} from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { useCategories } from '../hooks/useCategories';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, radius, spacing, touch, typography } from '../theme';
import { EMOJI_CHOICES, getCategoryMeta } from '../theme/categories';
import type { Category, Invite, Profile, Role } from '../types/models';

type Props = RootStackScreenProps<'Settings'>;

const ROLE_OPTIONS: ReadonlyArray<SegmentOption<Role>> = [
  { value: 'member', label: 'Member', icon: '👤' },
  { value: 'admin', label: 'Admin', icon: '🛡️' },
];

// --- Small helpers ----------------------------------------------------------

/**
 * One in-flight action per section: `busyKey` names the row being changed so
 * only its button spins, and `error` is shown in that section's banner.
 */
function useSectionAction() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async (key: string, action: () => Promise<void>): Promise<boolean> => {
    setBusyKey(key);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      if (mounted.current) {
        setError(AppError.from(err));
      }
      return false;
    } finally {
      if (mounted.current) {
        setBusyKey(null);
      }
    }
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { busyKey, error, run, clearError };
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function roleBadge(role: Role) {
  return role === 'admin' ? (
    <Badge label="Admin" icon="🛡️" tone="mine" />
  ) : (
    <Badge label="Member" icon="👤" tone="neutral" />
  );
}

// --- Expense type editor ----------------------------------------------------

interface CategoryEditorProps {
  initialName?: string;
  initialEmoji?: string;
  saving: boolean;
  saveTitle: string;
  onSave: (draft: { name: string; emoji: string }) => void;
  onCancel: () => void;
  testID?: string;
}

/** Name + emoji picker, shown inline under the row (or under "Add type"). */
function CategoryEditor({
  initialName = '',
  initialEmoji = '📦',
  saving,
  saveTitle,
  onSave,
  onCancel,
  testID,
}: CategoryEditorProps) {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [custom, setCustom] = useState(EMOJI_CHOICES.includes(initialEmoji) ? '' : initialEmoji);

  const pickChoice = (choice: string) => {
    setEmoji(choice);
    setCustom('');
  };
  const typeCustom = (value: string) => {
    const trimmed = value.trim();
    setCustom(value);
    if (trimmed) {
      setEmoji(trimmed);
    }
  };

  return (
    <View style={styles.editor} testID={testID}>
      <View style={styles.editorPreview}>
        <IconCircle emoji={emoji} bg={getCategoryMeta(name || 'new').bg} size={56} />
        <TextField
          icon="✏️"
          placeholder="Name, e.g. Feed"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          containerStyle={styles.editorName}
          testID={testID ? `${testID}-name` : undefined}
        />
      </View>
      <Text style={styles.editorLabel}>Pick a picture</Text>
      <View style={styles.chipWrap}>
        {EMOJI_CHOICES.map(choice => (
          <Chip
            key={choice}
            label={choice}
            selected={emoji === choice}
            onPress={() => pickChoice(choice)}
            style={styles.emojiChip}
          />
        ))}
      </View>
      <TextField
        icon="⌨️"
        placeholder="Or type any emoji"
        value={custom}
        onChangeText={typeCustom}
        maxLength={8}
        autoCorrect={false}
        containerStyle={styles.customEmoji}
      />
      <View style={styles.editorActions}>
        <Button
          icon="✅"
          title={saveTitle}
          size="lg"
          loading={saving}
          onPress={() => onSave({ name: name.trim(), emoji })}
          style={styles.grow}
          testID={testID ? `${testID}-save` : undefined}
        />
        <Button icon="✕" title="Cancel" variant="ghost" disabled={saving} onPress={onCancel} />
      </View>
    </View>
  );
}

// --- Expense types section --------------------------------------------------

function CategoriesSection({ isAdmin }: { isAdmin: boolean }) {
  const { categories, loading, error, fromCache, refresh } = useCategories({
    includeInactive: true,
  });
  const action = useSectionAction();
  /** Category id being edited, `'new'` for the add form, or null. */
  const [editing, setEditing] = useState<string | null>(null);
  // Cosmetic: members never see the controls, but RLS would reject them anyway.
  // Also hidden while we only have the built-in fallback list (offline / error).
  const canEdit = isAdmin && !fromCache;

  const save = useCallback(
    async (id: string | 'new', draft: { name: string; emoji: string }) => {
      const ok = await action.run(id, async () => {
        if (id === 'new') {
          await addCategory(draft);
        } else {
          await updateCategory(id, draft);
        }
        await refresh();
      });
      if (ok) {
        setEditing(null);
      }
    },
    [action, refresh],
  );

  const toggleActive = useCallback(
    (category: Category) =>
      action.run(category.id, async () => {
        await updateCategory(category.id, { active: !category.active });
        await refresh();
      }),
    [action, refresh],
  );

  const confirmRemove = useCallback(
    (category: Category) => {
      Alert.alert('Remove this type?', 'Old expenses keep their name.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            action.run(category.id, async () => {
              await removeCategory(category.id);
              await refresh();
            });
          },
        },
      ]);
    },
    [action, refresh],
  );

  return (
    <View style={styles.section}>
      <SectionTitle>🧾 Expense types</SectionTitle>
      <Card>
        {!isAdmin ? (
          <InfoBanner icon="🔒" message="Only an admin can change these" />
        ) : fromCache && !loading ? (
          <InfoBanner
            tone="warning"
            icon="📶"
            message="Showing the built-in list. Connect to make changes."
          />
        ) : null}
        <ErrorBanner message={error?.message} kind={error?.kind} onRetry={refresh} />
        <ErrorBanner
          message={action.error?.message}
          kind={action.error?.kind}
          onDismiss={action.clearError}
        />
        {loading ? <LoadingView message="Loading…" /> : null}
        {categories.map((category, i) => {
          const meta = getCategoryMeta(category.name, category.emoji);
          const busy = action.busyKey === category.id;
          const isEditing = editing === category.id;
          return (
            <View key={category.id}>
              {i > 0 ? <Divider /> : null}
              <View style={[styles.row, !category.active && styles.rowDimmed]}>
                <IconCircle emoji={meta.emoji} bg={meta.bg} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {category.name}
                  </Text>
                  {!category.active ? <Badge label="Hidden" icon="🙈" tone="neutral" /> : null}
                </View>
                {canEdit && !isEditing ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${category.name}`}
                    onPress={() => setEditing(category.id)}
                    disabled={busy}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                    testID={`settings-type-edit-${category.id}`}
                  >
                    <Text style={styles.iconButtonText}>✏️</Text>
                  </Pressable>
                ) : null}
              </View>
              {canEdit && isEditing ? (
                <CategoryEditor
                  initialName={category.name}
                  initialEmoji={category.emoji}
                  saving={busy}
                  saveTitle="Save"
                  onSave={draft => save(category.id, draft)}
                  onCancel={() => setEditing(null)}
                  testID="settings-type-editor"
                />
              ) : canEdit ? (
                <View style={styles.rowActions}>
                  <Button
                    icon={category.active ? '🙈' : '👁️'}
                    title={category.active ? 'Hide' : 'Show'}
                    variant="secondary"
                    loading={busy}
                    onPress={() => toggleActive(category)}
                    style={styles.grow}
                  />
                  <Button
                    icon="🗑️"
                    title="Remove"
                    variant="danger"
                    disabled={busy}
                    onPress={() => confirmRemove(category)}
                    style={styles.grow}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
        {canEdit ? (
          <View style={styles.addBlock}>
            {editing === 'new' ? (
              <CategoryEditor
                saving={action.busyKey === 'new'}
                saveTitle="Add"
                onSave={draft => save('new', draft)}
                onCancel={() => setEditing(null)}
                testID="settings-add-type-editor"
              />
            ) : (
              <Button
                icon="➕"
                title="Add type"
                size="lg"
                variant="secondary"
                onPress={() => setEditing('new')}
                testID="settings-add-type"
              />
            )}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

// --- Staff section (admins only) --------------------------------------------

function StaffSection({ me }: { me: Profile }) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const action = useSectionAction();
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const [nextMembers, nextInvites] = await Promise.all([listMembers(), listPendingInvites()]);
      if (mounted.current) {
        setMembers(nextMembers);
        setInvites(nextInvites);
        setLoadError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setLoadError(AppError.from(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const invite = useCallback(async () => {
    const ok = await action.run('invite', async () => {
      await inviteMember(email, role);
      await load();
    });
    if (ok && mounted.current) {
      setEmail('');
      setRole('member');
    }
  }, [action, email, role, load]);

  const revoke = useCallback(
    (inviteEmail: string) =>
      action.run(`invite:${inviteEmail}`, async () => {
        await revokeInvite(inviteEmail);
        await load();
      }),
    [action, load],
  );

  const toggleDisabled = useCallback(
    (member: Profile) => {
      const apply = () =>
        action.run(member.id, async () => {
          await setMemberDisabled(member.id, !member.disabled);
          await load();
        });
      if (!member.disabled) {
        Alert.alert(
          'Disable this account?',
          `${member.display_name || member.email} will not see any expenses until enabled again.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disable', style: 'destructive', onPress: () => apply() },
          ],
        );
      } else {
        apply();
      }
    },
    [action, load],
  );

  const changeRole = useCallback(
    (member: Profile) =>
      action.run(member.id, async () => {
        await setMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin');
        await load();
      }),
    [action, load],
  );

  return (
    <View style={styles.section}>
      <SectionTitle>👥 Staff</SectionTitle>
      <Card>
        <ErrorBanner
          message={action.error?.message}
          kind={action.error?.kind}
          onDismiss={action.clearError}
        />

        <Text style={styles.subTitle}>✉️ Invite someone</Text>
        <TextField
          icon="📧"
          placeholder="Their email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          testID="settings-invite-email"
        />
        <Segmented options={ROLE_OPTIONS} value={role} onChange={setRole} style={styles.roles} />
        <Button
          icon="✉️"
          title="Add to staff"
          size="lg"
          loading={action.busyKey === 'invite'}
          disabled={email.trim().length === 0}
          onPress={invite}
          testID="settings-invite-submit"
        />
        <Text style={styles.caption}>
          They can then create an account with this email. Anyone else is rejected.
        </Text>

        <Divider />
        <Text style={styles.subTitle}>⏳ Waiting to join</Text>
        <ErrorBanner message={loadError?.message} kind={loadError?.kind} onRetry={load} />
        {loading ? <LoadingView message="Loading…" /> : null}
        {!loading && invites.length === 0 ? (
          <Text style={styles.caption}>Nobody is waiting.</Text>
        ) : null}
        {invites.map(item => (
          <View key={item.email} style={styles.row}>
            <IconCircle emoji="📧" bg={colors.sharedSoft} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.email}
              </Text>
              {roleBadge(item.role)}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove invite for ${item.email}`}
              onPress={() => revoke(item.email)}
              disabled={action.busyKey === `invite:${item.email}`}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Text style={[styles.iconButtonText, styles.dangerText]}>✕</Text>
            </Pressable>
          </View>
        ))}

        <Divider />
        <Text style={styles.subTitle}>🧑‍🤝‍🧑 Staff</Text>
        {members.map(member => {
          const isSelf = member.id === me.id;
          const busy = action.busyKey === member.id;
          return (
            <View key={member.id} style={styles.memberBlock}>
              <View style={[styles.row, member.disabled && styles.rowDimmed]}>
                <IconCircle
                  emoji={member.disabled ? '🚫' : member.role === 'admin' ? '🛡️' : '👤'}
                  bg={member.disabled ? colors.dangerSoft : colors.primarySoft}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {member.display_name || member.email}
                  </Text>
                  {member.display_name ? (
                    <Text style={styles.caption} numberOfLines={1}>
                      {member.email}
                    </Text>
                  ) : null}
                  <View style={styles.badges}>
                    {roleBadge(member.role)}
                    {isSelf ? <Badge label="You" icon="⭐" tone="shared" /> : null}
                    {member.disabled ? <Badge label="Disabled" icon="🚫" tone="danger" /> : null}
                  </View>
                </View>
              </View>
              {/* Never offer to disable or demote yourself — you would lock yourself out. */}
              {isSelf ? null : (
                <View style={styles.rowActions}>
                  <Button
                    icon={member.disabled ? '✅' : '🚫'}
                    title={member.disabled ? 'Enable' : 'Disable'}
                    variant={member.disabled ? 'secondary' : 'danger'}
                    loading={busy}
                    onPress={() => toggleDisabled(member)}
                    style={styles.grow}
                  />
                  <Button
                    icon={member.role === 'admin' ? '👤' : '🛡️'}
                    title={member.role === 'admin' ? 'Make member' : 'Make admin'}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => changeRole(member)}
                    style={styles.grow}
                  />
                </View>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

// --- Screen -----------------------------------------------------------------

export default function SettingsScreen({ navigation }: Props) {
  const { user, profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<AppError | null>(null);
  // Cosmetic only — RLS decides what this account may actually change.
  const isAdmin = profile?.role === 'admin';

  const displayName = profile?.display_name?.trim() || profile?.email || user?.email || '';
  const email = profile?.email || user?.email || '';

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You can sign in again any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          setSignOutError(null);
          signOut().catch(err => {
            setSignOutError(AppError.from(err));
            setSigningOut(false);
          });
        },
      },
    ]);
  }, [signOut]);

  const openHelp = useCallback(
    () => navigation.navigate('Walkthrough', { replay: true }),
    [navigation],
  );

  const youBadge = useMemo(() => (profile ? roleBadge(profile.role) : null), [profile]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <SectionTitle>👤 You</SectionTitle>
        <Card>
          <View style={styles.row}>
            <IconCircle emoji={isAdmin ? '🛡️' : '👤'} bg={colors.primarySoft} size={56} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {displayName}
              </Text>
              {email && email !== displayName ? (
                <Text style={styles.caption} numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
              {youBadge}
            </View>
          </View>
        </Card>
      </View>

      <CategoriesSection isAdmin={isAdmin} />

      {isAdmin && profile ? <StaffSection me={profile} /> : null}

      <View style={styles.section}>
        <Button icon="❓" title="Help" size="lg" variant="secondary" onPress={openHelp} />
      </View>

      <View style={styles.section}>
        <ErrorBanner
          message={signOutError?.message}
          kind={signOutError?.kind}
          onDismiss={() => setSignOutError(null)}
        />
        <Button
          icon="🚪"
          title="Sign out"
          size="lg"
          variant="danger"
          loading={signingOut}
          onPress={confirmSignOut}
          testID="settings-signout"
        />
      </View>
    </ScrollView>
  );
}

// --- Styles -----------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.xl },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.heading },
  subTitle: { ...typography.bodyStrong, marginBottom: spacing.md },
  caption: { ...typography.caption, marginTop: spacing.xs },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touch.min },
  rowDimmed: { opacity: 0.55 },
  rowBody: { flex: 1, gap: spacing.xs },
  rowTitle: { ...typography.bodyStrong },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  memberBlock: { marginBottom: spacing.md },
  grow: { flexGrow: 1, flexBasis: 140 },

  iconButton: {
    minWidth: touch.min,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  iconButtonText: { fontSize: 24, color: colors.text },
  dangerText: { color: colors.danger, fontWeight: '700' },
  pressed: { opacity: 0.7 },

  editor: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  editorPreview: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  editorName: { flex: 1, marginBottom: 0 },
  editorLabel: { ...typography.label },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiChip: { paddingHorizontal: spacing.md, minWidth: 56, alignItems: 'center' },
  customEmoji: { marginBottom: 0, marginTop: spacing.xs },
  editorActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  addBlock: { marginTop: spacing.lg },
  roles: { marginBottom: spacing.lg },
});
