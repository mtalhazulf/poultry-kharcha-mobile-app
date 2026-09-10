import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteKharcha, getKharcha } from '../api/kharcha';
import { getProfilesByIds } from '../api/profiles';
import { listSharesForKharcha, unshareKharcha } from '../api/shares';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { ShareModal } from '../components/ShareModal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  IconCircle,
  InfoBanner,
  LoadingView,
} from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import { deleteReceipt } from '../lib/receipts';
import type { RootStackScreenProps } from '../navigation/types';
import {
  colors,
  formatAmount,
  formatDateFriendly,
  radius,
  spacing,
  touch,
  typography,
} from '../theme';
import { getCategoryMeta } from '../theme/categories';
import type { Kharcha, KharchaShareWithProfile, Profile } from '../types/models';

type Props = RootStackScreenProps<'ExpenseDetail'>;

function displayName(profile: Profile | null | undefined): string {
  return profile?.display_name ?? profile?.email ?? 'someone';
}

/**
 * Read view for one expense. The owner-only action row (Edit / Share /
 * Delete) is purely cosmetic: RLS on `kharcha`, `kharcha_shares` and the
 * `receipts` bucket rejects those calls from anyone but the owner.
 */
export default function ExpenseDetailScreen({ navigation, route }: Props) {
  const { kharchaId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [kharcha, setKharcha] = useState<Kharcha | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [shares, setShares] = useState<KharchaShareWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<AppError | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removingShareId, setRemovingShareId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const requestSeq = useRef(0);

  const isOwner = kharcha !== null && user !== null && kharcha.owner_id === user.id;

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setError(null);
    try {
      const row = await getKharcha(kharchaId);
      if (seq !== requestSeq.current) {
        return;
      }
      setKharcha(row);
      const mine = user !== null && row.owner_id === user.id;
      if (mine) {
        const list = await listSharesForKharcha(kharchaId);
        if (seq === requestSeq.current) {
          setShares(list);
        }
      } else {
        const [profile] = await getProfilesByIds([row.owner_id]);
        if (seq === requestSeq.current) {
          setOwner(profile ?? null);
        }
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setError(AppError.from(err));
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [kharchaId, user]);

  // Fires on mount and every time the screen regains focus (e.g. after Edit).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = useCallback(() => {
    if (!kharcha) {
      return;
    }
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setActionError(null);
          try {
            if (kharcha.receipt_path) {
              // Best effort: the row delete is what matters.
              await deleteReceipt(kharcha.receipt_path).catch(() => undefined);
            }
            await deleteKharcha(kharcha.id);
            navigation.goBack();
          } catch (err) {
            setActionError(AppError.from(err));
            setDeleting(false);
          }
        },
      },
    ]);
  }, [kharcha, navigation]);

  const removeShare = useCallback(async (share: KharchaShareWithProfile) => {
    setRemovingShareId(share.shared_with);
    setActionError(null);
    try {
      await unshareKharcha(share.kharcha_id, share.shared_with);
      setShares(prev => prev.filter(s => s.shared_with !== share.shared_with));
    } catch (err) {
      setActionError(AppError.from(err));
    } finally {
      setRemovingShareId(null);
    }
  }, []);

  if (loading) {
    return <LoadingView message="Loading expense…" />;
  }

  if (error && (error.kind === 'not_found' || error.kind === 'permission')) {
    return (
      <EmptyState
        emoji="🔍"
        title="This expense isn't available"
        message="It may have been deleted or is no longer shared with you."
        action={<Button title="Back" icon="↩️" size="lg" onPress={() => navigation.goBack()} />}
      />
    );
  }

  if (!kharcha) {
    return (
      <View style={styles.centered}>
        <ErrorBanner
          message={error?.message ?? 'Could not load this expense.'}
          kind={error?.kind}
          onRetry={load}
        />
        <Button
          title="Back"
          icon="↩️"
          size="lg"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const meta = getCategoryMeta(kharcha.category);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <ErrorBanner message={error.message} kind={error.kind} onRetry={load} /> : null}
        {actionError ? (
          <ErrorBanner
            message={actionError.message}
            kind={actionError.kind}
            onDismiss={() => setActionError(null)}
          />
        ) : null}

        <Card style={styles.summary}>
          <IconCircle emoji={meta.emoji} bg={meta.bg} size={64} />
          <View style={styles.summaryText}>
            <Text
              style={styles.amount}
              testID="detail-amount"
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {formatAmount(kharcha.amount)}
            </Text>
            <Text style={styles.category} numberOfLines={1}>
              {kharcha.category}
            </Text>
            <Text style={styles.date}>{formatDateFriendly(kharcha.expense_date)}</Text>
            {kharcha.visibility === 'shared' ? (
              <View style={styles.badgeRow}>
                <Badge label="Shared" icon="👥" tone="shared" />
              </View>
            ) : null}
          </View>
        </Card>

        {kharcha.note ? (
          <Card style={styles.noteCard}>
            <Text style={styles.noteIcon}>📝</Text>
            <Text style={styles.note} testID="detail-note">
              {kharcha.note}
            </Text>
          </Card>
        ) : null}

        {kharcha.receipt_path ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧾 Receipt</Text>
            <ReceiptPreview path={kharcha.receipt_path} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Sharing</Text>
          {isOwner ? (
            <Card style={styles.shareCard}>
              <Text style={styles.body}>
                {shares.length === 0
                  ? 'Not shared yet'
                  : `👥 Shared with ${shares.length} ${shares.length === 1 ? 'person' : 'people'}`}
              </Text>
              {shares.map(share => {
                const busy = removingShareId === share.shared_with;
                return (
                  <View key={share.shared_with} style={styles.shareRow}>
                    <View style={styles.shareText}>
                      <Text style={styles.bodyStrong} numberOfLines={1}>
                        {displayName(share.profile)}
                      </Text>
                      {share.profile.display_name ? (
                        <Text style={styles.caption} numberOfLines={1}>
                          {share.profile.email}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${displayName(share.profile)}`}
                      accessibilityState={{ disabled: removingShareId !== null, busy }}
                      disabled={removingShareId !== null}
                      onPress={() => removeShare(share)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        (pressed || removingShareId !== null) && styles.removeButtonDim,
                      ]}
                    >
                      <Text style={styles.removeText}>{busy ? '…' : '🗑️ Remove'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          ) : (
            <InfoBanner icon="👥" message={`Shared with you by ${displayName(owner)}`} />
          )}
        </View>
      </ScrollView>

      {isOwner ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button
            title="Edit"
            icon="✏️"
            variant="secondary"
            onPress={() => navigation.navigate('ExpenseForm', { kharchaId: kharcha.id })}
            disabled={deleting}
            style={styles.footerButton}
          />
          <Button
            title="Share"
            icon="👥"
            variant="secondary"
            onPress={() => setShareVisible(true)}
            disabled={deleting}
            style={styles.footerButton}
          />
          <Button
            title="Delete"
            icon="🗑️"
            variant="danger"
            onPress={confirmDelete}
            loading={deleting}
            style={styles.footerButton}
          />
        </View>
      ) : null}

      {isOwner ? (
        <ShareModal
          visible={shareVisible}
          kharchaId={kharcha.id}
          existingRecipientIds={shares.map(s => s.shared_with)}
          onClose={() => setShareVisible(false)}
          onShared={() => {
            load();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  centered: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryText: { flex: 1, gap: spacing.xs },
  amount: { ...typography.display },
  category: { ...typography.bodyStrong },
  date: { ...typography.caption },
  badgeRow: { flexDirection: 'row', marginTop: spacing.xs },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  noteIcon: { fontSize: 24 },
  note: { ...typography.body, flex: 1 },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label },
  shareCard: { gap: spacing.sm },
  body: { ...typography.body },
  bodyStrong: { ...typography.bodyStrong },
  caption: { ...typography.caption },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: touch.min,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  shareText: { flex: 1 },
  removeButton: {
    minHeight: touch.min,
    minWidth: touch.min,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonDim: { opacity: 0.6 },
  removeText: { ...typography.button, color: colors.danger, fontSize: 16 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  footerButton: { flex: 1, minHeight: touch.min, paddingHorizontal: spacing.sm },
});
