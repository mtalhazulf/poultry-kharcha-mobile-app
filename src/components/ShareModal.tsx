import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchProfilesByEmail } from '../api/profiles';
import { shareKharcha } from '../api/shares';
import { AppError } from '../lib/errors';
import { colors, radius, spacing, touch, typography } from '../theme';
import type { Profile } from '../types/models';
import { Button, Chip, ErrorBanner, TextField } from './ui';

interface ShareModalProps {
  visible: boolean;
  kharchaId: string;
  /** Users the expense is already shared with; excluded from search results. */
  existingRecipientIds: string[];
  onClose(): void;
  onShared(): void;
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

/**
 * Multi-select share sheet. Only the owner can actually share — the UI is
 * only opened for owners, but `shares_insert` RLS is what enforces it.
 */
export function ShareModal({
  visible,
  kharchaId,
  existingRecipientIds,
  onClose,
  onShared,
}: ShareModalProps) {
  const insets = useSafeAreaInsets();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<AppError | null>(null);
  const [selected, setSelected] = useState<Map<string, Profile>>(new Map());
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<AppError | null>(null);

  const trimmed = term.trim();
  // Stable key so the effect doesn't refire on every parent render.
  const excludeKey = existingRecipientIds.join(',');

  // Reset everything whenever the sheet is (re)opened.
  useEffect(() => {
    if (visible) {
      setTerm('');
      setResults([]);
      setSelected(new Map());
      setSearchError(null);
      setShareError(null);
      setSearching(false);
      setSharing(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(() => {
      searchProfilesByEmail(trimmed, { exclude: excludeKey ? excludeKey.split(',') : [] })
        .then(rows => {
          if (!cancelled) {
            setResults(rows);
            setSearchError(null);
            setSearching(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            setSearchError(AppError.from(err));
            setSearching(false);
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, excludeKey, visible]);

  const toggle = useCallback((profile: Profile) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(profile.id)) {
        next.delete(profile.id);
      } else {
        next.set(profile.id, profile);
      }
      return next;
    });
  }, []);

  const selectedList = useMemo(() => [...selected.values()], [selected]);

  const submit = useCallback(async () => {
    if (selectedList.length === 0) {
      return;
    }
    setSharing(true);
    setShareError(null);
    try {
      await shareKharcha(
        kharchaId,
        selectedList.map(p => p.id),
      );
      onShared();
      onClose();
    } catch (err) {
      setShareError(AppError.from(err));
    } finally {
      setSharing(false);
    }
  }, [kharchaId, selectedList, onShared, onClose]);

  const renderItem = useCallback(
    ({ item }: { item: Profile }) => {
      const isSelected = selected.has(item.id);
      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          onPress={() => toggle(item)}
          style={({ pressed }) => [
            styles.row,
            isSelected && styles.rowSelected,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected ? <Text style={styles.checkmark}>{'✓'}</Text> : null}
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.display_name ?? item.email}
            </Text>
            {item.display_name ? (
              <Text style={styles.rowEmail} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [selected, toggle],
  );

  let hint: string | null = null;
  if (trimmed.length < MIN_QUERY) {
    hint = 'Type at least 2 letters of their email to search.';
  } else if (!searching && !searchError && results.length === 0) {
    hint = 'No one found with that email.';
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={[styles.body, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>👥 Share with</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <TextField
            icon="🔍"
            placeholder="Type their email"
            value={term}
            onChangeText={setTerm}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="search"
            containerStyle={styles.search}
          />

          {selectedList.length > 0 ? (
            <View style={styles.chips}>
              {selectedList.map(p => (
                <Chip
                  key={p.id}
                  icon="👤"
                  label={p.display_name ?? p.email}
                  selected
                  onPress={() => toggle(p)}
                />
              ))}
            </View>
          ) : null}

          {searchError ? (
            <ErrorBanner
              message={searchError.message}
              kind={searchError.kind}
              onDismiss={() => setSearchError(null)}
            />
          ) : null}

          {searching ? (
            <View style={styles.searching}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          <FlatList
            data={results}
            keyExtractor={p => p.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={hint ? <Text style={styles.hint}>{hint}</Text> : undefined}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          {shareError ? <ErrorBanner message={shareError.message} kind={shareError.kind} /> : null}
          <Button
            title={selectedList.length > 0 ? `Share with ${selectedList.length}` : 'Share'}
            icon="✅"
            size="lg"
            onPress={submit}
            loading={sharing}
            disabled={selectedList.length === 0}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  title: { ...typography.title, flex: 1 },
  close: {
    width: touch.min,
    height: touch.min,
    borderRadius: touch.min / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { opacity: 0.85 },
  closeText: { fontSize: 24, fontWeight: '700', color: colors.text },
  search: { marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  searching: { paddingVertical: spacing.sm, alignItems: 'center' },
  list: { flex: 1 },
  hint: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowPressed: { opacity: 0.85 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '700' },
  rowText: { flex: 1 },
  rowName: { ...typography.bodyStrong },
  rowEmail: { ...typography.caption },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
