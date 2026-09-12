/**
 * Khata tab: every active member's running balance with the organization,
 * separate from expenses. Everyone sees everyone's balance; tapping a person
 * opens their entry history, and only your own khata lets you add to it.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { listKhataEntries } from '../api/khata';
import { listOrgMembers } from '../api/members';
import { personBalances } from '../components/khata/khataLogic';
import { AppHeader } from '../components/AppHeader';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { MainTabScreenProps } from '../navigation/types';
import { colors, CURRENCY, formatAmount, spacing } from '../theme';
import type { KhataEntry, Organization, OrgMember } from '../types/models';
import {
  AppText,
  Avatar,
  EmptyState,
  ErrorBanner,
  LIST_TEXT_INSET,
  ListGroup,
  ListItem,
  Screen,
} from '../ui';

type Props = MainTabScreenProps<'KhataTab'>;

/** AppHeader pads the status bar itself. */
const SIDE_EDGES = ['left', 'right'] as const;

export default function KhataScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { activeOrg } = useOrg();
  if (!user || !activeOrg) {
    return null;
  }
  return <KhataContent navigation={navigation} userId={user.id} org={activeOrg} />;
}

interface ContentProps {
  navigation: Props['navigation'];
  userId: string;
  org: Organization;
}

function balanceColor(balance: number): 'dangerText' | 'primaryText' | 'textSecondary' {
  if (balance > 0) {
    return 'dangerText';
  }
  if (balance < 0) {
    return 'primaryText';
  }
  return 'textSecondary';
}

function KhataContent({ navigation, userId, org }: ContentProps) {
  const orgId = org.id;
  const currency = org.currency || CURRENCY;
  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [entries, setEntries] = useState<KhataEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      setError(null);
      try {
        const [memberList, entryList] = await Promise.all([listOrgMembers(orgId), listKhataEntries(orgId)]);
        if (mounted.current) {
          setMembers(memberList);
          setEntries(entryList);
        }
      } catch (err) {
        if (mounted.current) {
          setError(AppError.from(err));
        }
      } finally {
        if (mounted.current) {
          setRefreshing(false);
        }
      }
    },
    [orgId],
  );

  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        load('initial');
      } else {
        focusedBefore.current = true;
        load('initial');
      }
    }, [load]),
  );

  const balances = useMemo(() => personBalances(entries, members ?? []), [entries, members]);

  const header = <AppHeader testID="khata-header" />;

  let body: React.ReactNode;
  if (members === null && !error) {
    body = null;
  } else if (error && members === null) {
    body = <ErrorBanner message={error.message} kind={error.kind} onRetry={() => load('initial')} />;
  } else if (balances.length === 0) {
    body = (
      <EmptyState icon="users" title="No one here yet" message="Active organization members will appear here." />
    );
  } else {
    body = (
      <ListGroup separatorInset={LIST_TEXT_INSET}>
        {balances.map(person => (
          <ListItem
            key={person.userId}
            title={person.userId === userId ? `${person.name} (you)` : person.name}
            leading={<Avatar name={person.name} email={person.email} uri={person.avatarUrl} />}
            trailing={
              <AppText variant="bodyStrong" color={balanceColor(person.balance)}>
                {person.balance === 0 ? '—' : formatAmount(person.balance, currency)}
              </AppText>
            }
            onPress={() => navigation.navigate('PersonKhata', { userId: person.userId })}
            testID={`khata-person-${person.userId}`}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <Screen
      scroll
      edges={SIDE_EDGES}
      header={header}
      gap={spacing.xxl}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} colors={[colors.primary]} />
      }
      testID="khata-screen"
    >
      <AppText variant="largeTitle" accessibilityRole="header">
        Khata
      </AppText>
      {error && members !== null ? (
        <ErrorBanner message={error.message} kind={error.kind} onDismiss={() => setError(null)} />
      ) : null}
      {body}
    </Screen>
  );
}
