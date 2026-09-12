/**
 * Team screen (opened from Settings). Admins get the invite code, pending
 * join requests and everyone in the organization (tap a person for role and
 * access). Members see a read-only list of active members. The RPCs re-check
 * every action; the UI only hides what they would refuse.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, Share, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { approveJoinRequest, declineJoinRequest, listOrgMembers } from '../api/members';
import { getInviteCode, regenerateInviteCode } from '../api/organizations';
import { InviteCodeCard } from '../components/team/InviteCodeCard';
import { MemberListSkeleton } from '../components/team/MemberListSkeleton';
import { MemberRow } from '../components/team/MemberRow';
import { RequestRow, type RequestAction } from '../components/team/RequestRow';
import {
  filterMembers,
  inviteShareMessage,
  MEMBER_SEARCH_THRESHOLD,
  splitMembers,
} from '../components/team/teamLogic';
import { useAuth } from '../context/AuthProvider';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, layout, spacing } from '../theme';
import type { OrgMember } from '../types/models';
import {
  AppText,
  EmptyState,
  ErrorBanner,
  IconButton,
  LIST_TEXT_INSET,
  ListGroup,
  Screen,
  SectionHeader,
  TextField,
} from '../ui';

type Props = RootStackScreenProps<'Team'>;
type LoadMode = 'initial' | 'refresh' | 'silent';

export default function TeamScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { activeOrg, isAdmin } = useOrg();
  const orgId = activeOrg?.id ?? null;
  const userId = user?.id ?? null;

  // Keyed by organization so a switch never shows the previous team.
  const [members, setMembers] = useState<{ orgId: string; list: OrgMember[] } | null>(null);
  const [membersError, setMembersError] = useState<AppError | null>(null);
  const [code, setCode] = useState<{ orgId: string; value: string } | null>(null);
  const [codeError, setCodeError] = useState<AppError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [review, setReview] = useState<{ userId: string; action: RequestAction } | null>(null);
  const [reviewError, setReviewError] = useState<AppError | null>(null);
  const [query, setQuery] = useState('');

  const mounted = useRef(true);
  const seq = useRef(0);
  const scrollRef = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const inviteY = useRef(0);
  // `load` and `resetCode` close over the organization they were created for.
  // A call that outlives a switch (the `finally` of an approval, say) must not
  // write the previous organization's rows over the new one's.
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: LoadMode) => {
      if (!orgId || orgIdRef.current !== orgId) {
        return;
      }
      const id = ++seq.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      if (mode === 'initial') {
        setMembersError(null);
        setCodeError(null);
      }
      const [membersResult, codeResult] = await Promise.allSettled([
        listOrgMembers(orgId),
        isAdmin ? getInviteCode(orgId) : Promise.resolve(null),
      ]);
      if (!mounted.current || id !== seq.current) {
        return;
      }
      if (membersResult.status === 'fulfilled') {
        setMembers({ orgId, list: membersResult.value });
        setMembersError(null);
      } else {
        setMembersError(AppError.from(membersResult.reason));
      }
      if (codeResult.status === 'fulfilled') {
        if (codeResult.value !== null) {
          setCode({ orgId, value: codeResult.value });
        }
        setCodeError(null);
      } else {
        setCodeError(AppError.from(codeResult.reason));
      }
      setRefreshing(false);
    },
    [orgId, isAdmin],
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  // Back from a member's page (role, access, removal): refresh quietly.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        loadRef.current('silent');
      }
      focusedBefore.current = true;
    }, []),
  );

  const list = members && members.orgId === orgId ? members.list : null;
  const inviteCode = code && code.orgId === orgId ? code.value : null;
  const { requests, people } = useMemo(() => splitMembers(list ?? []), [list]);
  const showSearch = people.length > MEMBER_SEARCH_THRESHOLD;
  const activeQuery = showSearch ? query : '';
  const visiblePeople = useMemo(() => filterMembers(people, activeQuery), [people, activeQuery]);

  const onInviteLayout = useCallback((event: LayoutChangeEvent) => {
    inviteY.current = event.nativeEvent.layout.y;
  }, []);

  const scrollToInvite = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, inviteY.current - spacing.lg), animated: true });
  }, []);

  const shareCode = useCallback(async () => {
    if (!activeOrg || !inviteCode) {
      return;
    }
    try {
      await Share.share({ message: inviteShareMessage(activeOrg.name, inviteCode) });
    } catch {
      // The system share sheet reports its own problems; nothing to add here.
    }
  }, [activeOrg, inviteCode]);

  const resetCode = useCallback(async () => {
    if (!orgId || orgIdRef.current !== orgId) {
      return;
    }
    setResetting(true);
    setCodeError(null);
    try {
      const next = await regenerateInviteCode(orgId);
      if (mounted.current && orgIdRef.current === orgId) {
        setCode({ orgId, value: next });
      }
    } catch (err) {
      if (mounted.current && orgIdRef.current === orgId) {
        setCodeError(AppError.from(err));
      }
    } finally {
      if (mounted.current) {
        setResetting(false);
      }
    }
  }, [orgId]);

  const confirmReset = useCallback(() => {
    Alert.alert(
      'Reset invite code?',
      'The current code stops working right away. Share the new code with anyone who still needs to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset code',
          style: 'destructive',
          onPress: () => {
            resetCode();
          },
        },
      ],
    );
  }, [resetCode]);

  const handleRequest = useCallback(
    async (member: OrgMember, action: RequestAction) => {
      if (!orgId || review) {
        return;
      }
      setReview({ userId: member.user_id, action });
      setReviewError(null);
      try {
        if (action === 'approve') {
          await approveJoinRequest(orgId, member.user_id);
        } else {
          await declineJoinRequest(orgId, member.user_id);
        }
        if (!mounted.current) {
          return;
        }
        const approvedAt = new Date().toISOString();
        setMembers(prev =>
          prev && prev.orgId === orgId
            ? {
                orgId,
                list:
                  action === 'approve'
                    ? prev.list.map(m =>
                        m.user_id === member.user_id
                          ? { ...m, status: 'active' as const, approved_at: approvedAt }
                          : m,
                      )
                    : prev.list.filter(m => m.user_id !== member.user_id),
              }
            : prev,
        );
      } catch (err) {
        if (mounted.current) {
          setReviewError(AppError.from(err));
        }
      } finally {
        if (mounted.current) {
          setReview(null);
          load('silent');
        }
      }
    },
    [orgId, review, load],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: isAdmin
        ? () => (
            <IconButton
              icon="user-plus"
              accessibilityLabel="Invite people"
              onPress={scrollToInvite}
              testID="team-invite"
            />
          )
        : undefined,
    });
  }, [navigation, isAdmin, scrollToInvite]);

  return (
    <Screen padded={false} testID="team-screen">
      {/* Keyboard-aware (docs/ARCHITECTURE.md §6): the member search field sits
          below the invite card and the requests, well under the keyboard. */}
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.content}
        bottomOffset={spacing.lg}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              load('refresh');
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <AppText variant="largeTitle" accessibilityRole="header">
          Team
        </AppText>

        {isAdmin ? (
          <InviteCodeCard
            code={inviteCode}
            loading={inviteCode === null && codeError === null}
            error={codeError}
            onRetry={() => {
              load('initial');
            }}
            onShare={shareCode}
            onReset={confirmReset}
            resetting={resetting}
            onLayout={onInviteLayout}
          />
        ) : null}

        <ErrorBanner
          message={membersError?.message}
          kind={membersError?.kind}
          onRetry={() => {
            load('initial');
          }}
          testID="team-error"
        />
        <ErrorBanner
          message={reviewError?.message}
          kind={reviewError?.kind}
          onDismiss={() => setReviewError(null)}
        />

        {list === null && membersError === null ? <MemberListSkeleton /> : null}

        {isAdmin && requests.length > 0 ? (
          <ListGroup
            title={`Requests (${requests.length})`}
            separatorInset={LIST_TEXT_INSET}
            testID="team-requests"
          >
            {requests.map(member => (
              <RequestRow
                key={member.user_id}
                member={member}
                busy={review?.userId === member.user_id ? review.action : null}
                locked={review !== null}
                onApprove={() => {
                  handleRequest(member, 'approve');
                }}
                onDecline={() => {
                  handleRequest(member, 'decline');
                }}
              />
            ))}
          </ListGroup>
        ) : null}

        {list !== null ? (
          <View style={styles.section}>
            <SectionHeader title={`Members (${people.length})`} />
            {showSearch ? (
              <TextField
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or email"
                accessibilityLabel="Search members"
                leftIcon="search"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                submitBehavior="blurAndSubmit"
                right={
                  query ? (
                    <IconButton
                      icon="x"
                      size="sm"
                      accessibilityLabel="Clear search"
                      onPress={() => setQuery('')}
                    />
                  ) : null
                }
                testID="team-search"
              />
            ) : null}
            {visiblePeople.length > 0 ? (
              <ListGroup separatorInset={LIST_TEXT_INSET} testID="team-members">
                {visiblePeople.map(member => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    isSelf={member.user_id === userId}
                    onPress={
                      isAdmin
                        ? () => navigation.navigate('MemberDetail', { userId: member.user_id })
                        : undefined
                    }
                  />
                ))}
              </ListGroup>
            ) : activeQuery.trim() ? (
              <EmptyState
                icon="search"
                title="No matches"
                message={`No one matches "${activeQuery.trim()}".`}
              />
            ) : (
              <EmptyState
                icon="users"
                title="No one to show yet"
                message="People appear here once they join."
              />
            )}
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: { gap: spacing.sm },
});
