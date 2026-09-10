import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { deleteKharcha, getKharcha } from '../api/kharcha';
import { getProfilesByIds } from '../api/profiles';
import { listSharesForKharcha, unshareKharcha } from '../api/shares';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { ShareModal } from '../components/ShareModal';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorBanner,
  InfoBanner,
  LoadingView,
} from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { AppError } from '../lib/errors';
import { deleteReceipt } from '../lib/receipts';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, formatAmount, formatDate, spacing, typography } from '../theme';
import type { Kharcha, KharchaShareWithProfile, Profile } from '../types/models';

type Props = RootStackScreenProps<'ExpenseDetail'>;

function displayName(profile: Profile | null | undefined): string {
  return profile?.display_name ?? profile?.email ?? 'someone';
}

/**
 * Read view for one expense. The owner-only action row (Share / Edit /
 * Delete) is purely cosmetic: RLS on `kharcha`, `kharcha_shares` and the
 * `receipts` bucket rejects those calls from anyone but the owner.
 */
export default function ExpenseDetailScreen({ navigation, route }: Props) {
  const { kharchaId } = route.params;
  const { user } = useAuth();

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
        title="This expense isn't available"
        message="It may have been deleted or is no longer shared with you."
        action={<Button title="Back" onPress={() => navigation.goBack()} />}
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
        <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }

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
        {!isOwner ? <InfoBanner message="You have read-only access to this expense" /> : null}

        <Card style={styles.summary}>
          <Text style={styles.amount} testID="detail-amount">
            {formatAmount(kharcha.amount)}
          </Text>
          <View style={styles.metaRow}>
            <Badge label={kharcha.category} tone="mine" />
            {kharcha.visibility === 'shared' ? <Badge label="Shared" tone="shared" /> : null}
          </View>
          <Text style={styles.date}>{formatDate(kharcha.expense_date)}</Text>
          {kharcha.note ? (
            <>
              <Divider />
              <Text style={styles.note}>{kharcha.note}</Text>
            </>
          ) : null}
        </Card>

        {kharcha.receipt_path ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt</Text>
            <ReceiptPreview path={kharcha.receipt_path} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sharing</Text>
          {isOwner ? (
            <Card>
              <Text style={styles.body}>
                {shares.length === 0
                  ? 'Not shared with anyone yet.'
                  : `Shared with ${shares.length} ${shares.length === 1 ? 'person' : 'people'}`}
              </Text>
              {shares.map(share => (
                <View key={share.shared_with} style={styles.shareRow}>
                  <View style={styles.shareText}>
                    <Text style={styles.body} numberOfLines={1}>
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
                    disabled={removingShareId !== null}
                    onPress={() => removeShare(share)}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.removeText,
                        removingShareId === share.shared_with && styles.removeTextBusy,
                      ]}
                    >
                      {removingShareId === share.shared_with ? 'Removing…' : 'Remove'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Text style={styles.body}>Shared with you by {displayName(owner)}</Text>
            </Card>
          )}
        </View>

        {isOwner ? (
          <View style={styles.actions}>
            <Button
              title="Share"
              variant="secondary"
              onPress={() => setShareVisible(true)}
              disabled={deleting}
              style={styles.actionButton}
            />
            <Button
              title="Edit"
              variant="secondary"
              onPress={() => navigation.navigate('ExpenseForm', { kharchaId: kharcha.id })}
              disabled={deleting}
              style={styles.actionButton}
            />
            <Button
              title="Delete"
              variant="danger"
              onPress={confirmDelete}
              loading={deleting}
              style={styles.actionButton}
            />
          </View>
        ) : null}
      </ScrollView>

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
  summary: { gap: spacing.sm },
  amount: { ...typography.amount, fontSize: 32 },
  metaRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  date: { ...typography.caption },
  note: { ...typography.body },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label },
  body: { ...typography.body },
  caption: { ...typography.caption },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  shareText: { flex: 1 },
  removeText: { ...typography.label, color: colors.danger },
  removeTextBusy: { opacity: 0.5 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1, paddingHorizontal: spacing.sm },
});
