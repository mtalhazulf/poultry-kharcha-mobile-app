/**
 * The organisation's expense types. Everyone can look; admins tap a type to
 * change it, or add a new one from the button at the bottom. Hidden types sit
 * in their own group so the main list matches the Add-expense screen. RLS
 * enforces who may write; the edit controls are only hidden for members.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListGroup, ListRow } from '../components/ListRow';
import { Button, ErrorBanner, InfoBanner } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { useCategories } from '../hooks/useCategories';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { getCategoryMeta } from '../theme/categories';
import type { Category } from '../types/models';

type Props = RootStackScreenProps<'ExpenseTypes'>;

export default function ExpenseTypesScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const insets = useSafeAreaInsets();
  const { categories, loading, error, fromCache, refresh } = useCategories({
    includeInactive: isAdmin,
  });
  // The built-in fallback list has no database rows to edit.
  const canEdit = isAdmin && !fromCache;

  // Pick up changes made on the edit screen when coming back.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false; // the hook's initial load already ran
        return;
      }
      refresh();
    }, [refresh]),
  );

  const active = categories.filter(c => c.active);
  const hidden = categories.filter(c => !c.active);

  const renderRow = (category: Category) => {
    const meta = getCategoryMeta(category.name, category.emoji);
    return (
      <ListRow
        key={category.id}
        icon={meta.emoji}
        iconBg={meta.bg}
        title={category.name}
        dimmed={!category.active}
        onPress={canEdit ? () => navigation.navigate('ExpenseTypeEdit', { category }) : undefined}
        testID={`type-row-${category.name}`}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: canEdit ? spacing.xl : insets.bottom + spacing.xxl },
        ]}
      >
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

        <ListGroup
          title={canEdit ? `In use (${active.length})` : undefined}
          footer={canEdit ? 'Tap a type to rename it, change its picture, or hide it.' : undefined}
        >
          {active.map(renderRow)}
        </ListGroup>

        {canEdit ? (
          <ListGroup
            title={`Hidden (${hidden.length})`}
            footer="Hidden types stay on old expenses but can't be picked for new ones."
          >
            {hidden.map(renderRow)}
          </ListGroup>
        ) : null}
      </ScrollView>

      {canEdit ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button
            size="lg"
            icon="➕"
            title="Add type"
            onPress={() => navigation.navigate('ExpenseTypeEdit')}
            testID="settings-add-type"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
