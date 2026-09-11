/**
 * Invite one person (admins). Sign-up is invite-only, so this email is their
 * only way into the app. RLS rejects the insert for anyone who is not an admin.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { inviteMember } from '../api/staff';
import {
  Button,
  ErrorBanner,
  InfoBanner,
  Segmented,
  TextField,
  type SegmentOption,
} from '../components/ui';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import type { Role } from '../types/models';

type Props = RootStackScreenProps<'InviteStaff'>;

const ROLE_OPTIONS: ReadonlyArray<SegmentOption<Role>> = [
  { value: 'member', label: 'Member', icon: '👤' },
  { value: 'admin', label: 'Admin', icon: '🛡️' },
];

export default function InviteStaffScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await inviteMember(email, role);
      navigation.goBack();
    } catch (err) {
      setError(AppError.from(err));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />
        <TextField
          label="Their email"
          icon="📧"
          placeholder="name@gmail.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          autoFocus
          editable={!saving}
          testID="settings-invite-email"
        />
        <Text style={styles.label}>Role</Text>
        <Segmented options={ROLE_OPTIONS} value={role} onChange={setRole} />
        <Text style={styles.hint}>
          {role === 'admin'
            ? 'Admins can change expense types and manage staff.'
            : 'Members add and share their own expenses.'}
        </Text>
        <InfoBanner
          icon="🔒"
          message="They create their account in the app with this email. Anyone else is turned away."
          style={styles.note}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button
          size="lg"
          icon="✉️"
          title="Add to staff"
          loading={saving}
          disabled={email.trim().length === 0}
          onPress={submit}
          testID="settings-invite-submit"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { ...typography.label, marginBottom: spacing.sm },
  hint: { ...typography.caption, marginTop: spacing.sm },
  note: { marginTop: spacing.xl },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
