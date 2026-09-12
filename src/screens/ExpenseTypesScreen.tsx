/**
 * Expense types of the active organization. Everyone can look; admins open a
 * type to rename it, change its icon or hide it, and add new ones from the
 * footer. Hidden types sit in their own group so "In use" matches the
 * expense form. RLS enforces who may write.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useOrg } from '../context/OrgProvider';
import { useCategories } from '../hooks/useCategories';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, layout, radius, spacing } from '../theme';
import type { Category } from '../types/models';
import {
  Banner,
  Button,
  Card,
  CategoryTile,
  Divider,
  EmptyState,
  ErrorBanner,
  LIST_TEXT_INSET,
  ListGroup,
  ListItem,
  Screen,
  Skeleton,
} from '../ui';

type Props = RootStackScreenProps<'ExpenseTypes'>;

function TypesSkeleton() {
  return (
    <View style={styles.skeleton} accessible accessibilityRole="progressbar" accessibilityLabel="Loading expense types">
      <Skeleton width={96} height={12} style={styles.skeletonTitle} />
      <Card padded={false}>
        {[0, 1, 2, 3, 4].map(index => (
          <React.Fragment key={index}>
            {index > 0 ? <Divider inset={LIST_TEXT_INSET} /> : null}
            <View style={styles.skeletonRow}>
              <Skeleton width={layout.tile.md} height={layout.tile.md} radius={radius.sm} />
              <Skeleton width="40%" height={14} />
            </View>
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
}

export default function ExpenseTypesScreen({ navigation }: Props) {
  const { activeOrg, isAdmin } = useOrg();
  const { categories, loading, error, fromCache, refresh } = useCategories(activeOrg?.id ?? null, {
    includeInactive: isAdmin,
  });
  const [refreshing, setRefreshing] = useState(false);
  // The offline fallback list has no rows to edit.
  const canEdit = isAdmin && !fromCache;

  // Pick up changes made on the edit screen.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        refresh();
      }
      focusedBefore.current = true;
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const active = useMemo(() => categories.filter(category => category.active), [categories]);
  const hidden = useMemo(() => categories.filter(category => !category.active), [categories]);

  const renderRow = (category: Category) => (
    <ListItem
      key={category.id}
      title={category.name}
      leading={<CategoryTile name={category.name} icon={category.icon} />}
      onPress={
        canEdit
          ? () => navigation.navigate('ExpenseTypeEdit', { categoryId: category.id })
          : undefined
      }
      testID={`type-row-${category.name}`}
    />
  );

  const showSkeleton = loading && categories.length === 0;
  const showEmpty = !loading && categories.length === 0 && !error;

  return (
    <Screen
      scroll
      gap={spacing.xxl}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      footer={
        canEdit ? (
          <Button
            title="Add type"
            icon="plus"
            onPress={() => navigation.navigate('ExpenseTypeEdit')}
            fullWidth
            testID="settings-add-type"
          />
        ) : undefined
      }
      testID="expense-types"
    >
      {isAdmin ? null : (
        <Banner tone="info" icon="lock" message="Only an admin can change these" testID="types-admin-only" />
      )}
      <ErrorBanner
        message={error?.message}
        kind={error?.kind}
        onRetry={() => {
          onRefresh();
        }}
      />
      {showSkeleton ? <TypesSkeleton /> : null}

      <ListGroup
        title={`In use (${active.length})`}
        separatorInset={LIST_TEXT_INSET}
        footer={canEdit ? 'Tap a type to rename it, change its icon or hide it.' : undefined}
        testID="types-in-use"
      >
        {active.map(renderRow)}
      </ListGroup>

      <ListGroup
        title={`Hidden (${hidden.length})`}
        separatorInset={LIST_TEXT_INSET}
        footer="Hidden types stay on past expenses but can't be picked for new ones."
        testID="types-hidden"
      >
        {hidden.map(renderRow)}
      </ListGroup>

      {showEmpty ? (
        <EmptyState
          icon="list"
          title="No expense types yet"
          message={canEdit ? 'Add the types your team records, like Feed or Medicine.' : 'An admin can add expense types.'}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: spacing.sm },
  skeletonTitle: { marginLeft: spacing.xs },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
