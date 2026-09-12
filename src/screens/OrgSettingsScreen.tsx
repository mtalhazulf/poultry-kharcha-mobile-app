/**
 * The active organization. Admins rename it; everyone sees the currency and
 * their role, and can leave, except the owner, who has to hand over
 * ownership first (the RPC refuses otherwise).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import {
  leaveOrganization,
  renameOrganization,
  setOrganizationCurrency,
  validateOrganizationName,
} from '../api/organizations';
import { roleLabel, roleTone } from '../components/team/teamLogic';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, CURRENCY_OPTIONS, layout, radius, spacing } from '../theme';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  ErrorBanner,
  Icon,
  LIST_TEXT_INSET,
  ListGroup,
  ListItem,
  Screen,
  SectionHeader,
  Sheet,
  TextField,
} from '../ui';

type Props = RootStackScreenProps<'OrgSettings'>;

export default function OrgSettingsScreen({ navigation }: Props) {
  const { activeOrg, role, isAdmin, isOwner, refresh } = useOrg();

  const [draft, setDraft] = useState<string | null>(null);
  // The saved name until OrgProvider's refresh brings it in.
  const [renamedTo, setRenamedTo] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencyError, setCurrencyError] = useState<AppError | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const providerName = activeOrg?.name ?? '';
  if (renamedTo !== null && providerName === renamedTo) {
    setRenamedTo(null);
  }
  const savedName = renamedTo ?? providerName;
  const value = draft ?? savedName;
  const dirty = draft !== null && draft.trim() !== savedName;

  const save = useCallback(async () => {
    if (!activeOrg || !isAdmin || saving || !dirty) {
      return;
    }
    const problem = validateOrganizationName(value);
    if (problem) {
      setNameError(problem);
      return;
    }
    const nextName = value.trim();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await renameOrganization(activeOrg.id, nextName);
      if (!mounted.current) {
        return;
      }
      setRenamedTo(nextName);
      setDraft(null);
      setSaved(true);
      await refresh();
    } catch (err) {
      if (mounted.current) {
        const appErr = AppError.from(err);
        if (appErr.kind === 'validation') {
          setNameError(appErr.message);
        } else {
          setError(appErr);
        }
      }
    } finally {
      if (mounted.current) {
        setSaving(false);
      }
    }
  }, [activeOrg, isAdmin, saving, dirty, value, refresh]);

  const pickCurrency = useCallback(
    async (code: string) => {
      if (!activeOrg || currencySaving || code === activeOrg.currency) {
        setCurrencySheetOpen(false);
        return;
      }
      setCurrencySaving(true);
      setCurrencyError(null);
      try {
        await setOrganizationCurrency(activeOrg.id, code);
        if (mounted.current) {
          setCurrencySheetOpen(false);
          await refresh();
        }
      } catch (err) {
        if (mounted.current) {
          setCurrencyError(AppError.from(err));
        }
      } finally {
        if (mounted.current) {
          setCurrencySaving(false);
        }
      }
    },
    [activeOrg, currencySaving, refresh],
  );

  const leave = useCallback(async () => {
    if (!activeOrg) {
      return;
    }
    setLeaving(true);
    setError(null);
    try {
      await leaveOrganization(activeOrg.id);
    } catch (err) {
      if (mounted.current) {
        setError(AppError.from(err));
        setLeaving(false);
      }
      return;
    }
    // Leave this screen first: the refresh switches to another organization,
    // or to the welcome screen when none is left.
    if (mounted.current && navigation.canGoBack()) {
      navigation.goBack();
    }
    await refresh();
  }, [activeOrg, navigation, refresh]);

  const confirmLeave = useCallback(() => {
    Alert.alert(
      'Leave organization?',
      `You lose access to ${savedName} and its expenses. To come back you need an invite code and approval.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            leave();
          },
        },
      ],
    );
  }, [leave, savedName]);

  if (!activeOrg) {
    return <Screen testID="org-settings" />;
  }

  return (
    <Screen
      keyboard
      gap={spacing.xxl}
      footer={
        isAdmin ? (
          <Button
            title="Save changes"
            onPress={save}
            loading={saving}
            disabled={!dirty}
            fullWidth
            testID="org-save"
          />
        ) : undefined
      }
      testID="org-settings"
    >
      <ErrorBanner message={error?.message} kind={error?.kind} onDismiss={() => setError(null)} />
      {saved ? (
        <Banner tone="success" message="Organization name saved." onDismiss={() => setSaved(false)} />
      ) : null}

      <TextField
        label="Organization name"
        value={value}
        onChangeText={text => {
          setDraft(text);
          setNameError(null);
          setSaved(false);
        }}
        editable={isAdmin && !saving}
        error={nameError}
        helperText={isAdmin ? undefined : 'Only an admin can rename the organization.'}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={80}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={save}
        testID="org-name"
      />

      <ListGroup separatorInset={LIST_TEXT_INSET}>
        <ListItem
          title="Currency"
          leadingIcon="banknote"
          value={activeOrg.currency}
          onPress={isAdmin ? () => setCurrencySheetOpen(true) : undefined}
          disabled={!isAdmin}
          testID="org-currency"
        />
        <ListItem
          title="Your role"
          leadingIcon="shield"
          trailing={role ? <Badge label={roleLabel(role)} tone={roleTone(role)} /> : undefined}
        />
      </ListGroup>

      {currencyError ? (
        <ErrorBanner
          message={currencyError.message}
          kind={currencyError.kind}
          onDismiss={() => setCurrencyError(null)}
        />
      ) : null}

      {isAdmin ? (
        <ListGroup separatorInset={LIST_TEXT_INSET}>
          <ListItem
            title="Invite code and requests"
            leadingIcon="user-plus"
            onPress={() => navigation.navigate('Team')}
            testID="org-open-team"
          />
        </ListGroup>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Danger zone" />
        <Card style={styles.danger}>
          <AppText variant="bodyStrong">Leave organization</AppText>
          {isOwner ? (
            <AppText variant="callout" color="textSecondary">
              Transfer ownership from Team in Settings before leaving.
            </AppText>
          ) : (
            <>
              <AppText variant="callout" color="textSecondary">
                You lose access to its expenses. Rejoining needs an invite code and approval.
              </AppText>
              <Button
                title="Leave organization"
                icon="log-out"
                variant="danger"
                onPress={confirmLeave}
                loading={leaving}
                testID="org-leave"
              />
            </>
          )}
        </Card>
      </View>

      <Sheet
        visible={currencySheetOpen}
        onClose={() => setCurrencySheetOpen(false)}
        title="Currency"
        testID="currency-sheet"
      >
        <View style={styles.currencyGrid} accessibilityRole="radiogroup">
          {CURRENCY_OPTIONS.map(option => {
            const selected = option.code === activeOrg.currency;
            return (
              <Pressable
                key={option.code}
                accessibilityRole="radio"
                accessibilityLabel={`${option.code}, ${option.label}`}
                accessibilityState={{ selected, checked: selected, disabled: currencySaving }}
                disabled={currencySaving}
                onPress={() => pickCurrency(option.code)}
                testID={`currency-${option.code}`}
                style={({ pressed }) => [
                  styles.currencyOption,
                  selected ? styles.currencyOptionSelected : null,
                  pressed && !selected ? styles.currencyOptionPressed : null,
                  currencySaving ? styles.currencyOptionDisabled : null,
                ]}
              >
                <View style={styles.currencyText}>
                  <AppText variant="body" color={selected ? 'primaryText' : 'text'}>
                    {option.code}
                  </AppText>
                  <AppText variant="callout" color="textSecondary">
                    {option.label}
                  </AppText>
                </View>
                {selected ? (
                  <Icon name="check" size={layout.icon.sm} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  danger: { gap: spacing.sm },
  currencyGrid: { gap: spacing.sm },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: layout.control.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  currencyOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  currencyOptionPressed: { backgroundColor: colors.surfaceMuted },
  currencyOptionDisabled: { opacity: 0.5 },
  currencyText: { gap: spacing.xxs },
});
