/**
 * Reports tab: spending for one month at a time. `report_summary` runs with
 * the caller's privileges, so owners and admins see the whole organization
 * and members their own expenses plus ones shared with them. The change
 * badge compares with the same stretch of the previous month
 * (reportMath.comparisonPeriod), so a month in progress is never measured
 * against a finished one.
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { fillDailyTotals, getReportSummary } from '../api/reports';
import { AppHeader } from '../components/AppHeader';
import { BreakdownRow } from '../components/reports/BreakdownRow';
import { DailySpendChart } from '../components/reports/DailySpendChart';
import { KpiCard, kpiLayout } from '../components/reports/KpiCard';
import { MonthStepper } from '../components/reports/MonthStepper';
import { ReportSkeleton } from '../components/reports/ReportSkeleton';
import {
  compareMonths,
  comparisonPeriod,
  dailyAverage,
  elapsedDays,
  formatDeltaPercent,
  monthId,
  monthLabel,
  monthOf,
  monthRange,
  shiftMonth,
  spendDelta,
  type ComparisonPeriod,
  type MonthKey,
  type SpendDelta,
} from '../components/reports/reportMath';
import { useOrg } from '../context/OrgProvider';
import { AppError } from '../lib/errors';
import {
  colors,
  CURRENCY,
  formatAmount,
  formatAmountShort,
  layout,
  spacing,
  toIsoDate,
} from '../theme';
import type { ReportSummary } from '../types/models';
import {
  AppText,
  Avatar,
  Badge,
  Card,
  CategoryTile,
  EmptyState,
  ErrorBanner,
  Icon,
  LIST_TEXT_INSET,
  ListGroup,
  Money,
  Screen,
  SectionHeader,
} from '../ui';

type LoadMode = 'initial' | 'refresh' | 'silent';

interface LoadedReport {
  /** `<orgId>:<YYYY-MM>` the numbers belong to. */
  key: string;
  summary: ReportSummary;
  /** Spend in the comparison period; null when it could not be loaded. */
  comparisonTotal: number | null;
}

/** AppHeader pads the status bar itself. */
const SIDE_EDGES = ['left', 'right'] as const;

function spokenDelta(delta: SpendDelta, comparison: ComparisonPeriod): string {
  const period = comparison.label.replace('–', ' to ');
  if (delta.percent === null) {
    return `No spend in ${period} to compare.`;
  }
  if (delta.direction === 'flat') {
    return `No change compared with ${period}.`;
  }
  return `${delta.direction === 'up' ? 'Up' : 'Down'} ${delta.percent} percent compared with ${period}.`;
}

function DeltaFooter({ delta, comparison }: { delta: SpendDelta; comparison: ComparisonPeriod }) {
  if (delta.percent === null) {
    return (
      <AppText variant="caption" color="textSecondary">
        {`No spend in ${comparison.label} to compare`}
      </AppText>
    );
  }
  const up = delta.direction === 'up';
  return (
    <>
      {delta.direction === 'flat' ? (
        <Badge label="No change" tone="neutral" />
      ) : (
        <Badge
          label={formatDeltaPercent(delta.percent)}
          tone={up ? 'warning' : 'success'}
          icon={up ? 'trending-up' : 'trending-down'}
        />
      )}
      <AppText variant="caption" color="textSecondary">
        {`vs ${comparison.label}`}
      </AppText>
    </>
  );
}

export default function ReportsScreen() {
  const { activeOrg, isAdmin } = useOrg();
  const orgId = activeOrg?.id ?? null;
  const currency = activeOrg?.currency ?? CURRENCY;

  const [month, setMonth] = useState<MonthKey>(() => monthOf(new Date()));
  const [report, setReport] = useState<LoadedReport | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: AppError } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mounted = useRef(true);
  const seq = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: LoadMode) => {
      if (!orgId) {
        return;
      }
      const requestKey = `${orgId}:${monthId(month)}`;
      const id = ++seq.current;
      const isCurrent = () => mounted.current && id === seq.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      const range = monthRange(month);
      const comparison = comparisonPeriod(month, new Date());
      try {
        const [summary, comparisonTotal] = await Promise.all([
          getReportSummary(orgId, range.from, range.to),
          // The badge is optional: a failed comparison hides it, not the report.
          getReportSummary(orgId, comparison.from, comparison.to).then(
            result => result.total,
            () => null,
          ),
        ]);
        if (!isCurrent()) {
          return;
        }
        setReport({ key: requestKey, summary, comparisonTotal });
        setFailure(null);
      } catch (err) {
        if (isCurrent()) {
          setFailure({ key: requestKey, error: AppError.from(err) });
        }
      } finally {
        if (isCurrent()) {
          setRefreshing(false);
        }
      }
    },
    [orgId, month],
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  // Back on the tab after adding or editing expenses: refresh quietly.
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

  const goPrevious = useCallback(() => setMonth(current => shiftMonth(current, -1)), []);
  const goNext = useCallback(
    () =>
      setMonth(current => {
        const next = shiftMonth(current, 1);
        return compareMonths(next, monthOf(new Date())) > 0 ? current : next;
      }),
    [],
  );

  const today = new Date();
  const todayIso = toIsoDate(today);
  const isCurrentMonth = compareMonths(month, monthOf(today)) >= 0;
  const period = monthLabel(month);
  const comparison = comparisonPeriod(month, today);
  const { from, to } = monthRange(month);

  const key = orgId ? `${orgId}:${monthId(month)}` : '';
  const data = report && report.key === key ? report : null;
  const error = failure && failure.key === key ? failure.error : null;
  const days = useMemo(
    () => (data ? fillDailyTotals(data.summary.byDay, from, to) : []),
    [data, from, to],
  );

  let body: React.ReactNode = null;
  if (data && data.summary.count === 0) {
    body = (
      <EmptyState
        icon="chart-column"
        title={isCurrentMonth ? 'No expenses this month' : `No expenses in ${period}`}
        message="Totals and breakdowns appear once expenses are added."
        testID="reports-empty"
      />
    );
  } else if (data) {
    const { summary } = data;
    const delta =
      data.comparisonTotal === null ? null : spendDelta(summary.total, data.comparisonTotal);
    const countedDays = Math.max(elapsedDays(month, today), 1);
    const average = dailyAverage(summary.total, countedDays);
    const daysWithSpend = days.filter(day => day.total > 0).length;
    const daysText = daysWithSpend === 1 ? '1 day' : `${daysWithSpend} days`;
    const entriesText = summary.count === 1 ? '1 entry' : `${summary.count} entries`;

    body = (
      <>
        <View style={kpiLayout.row}>
          <KpiCard
            label="Total spend"
            style={kpiLayout.wide}
            accessibilityLabel={`Total spend ${formatAmount(summary.total, currency)}. ${
              delta ? spokenDelta(delta, comparison) : ''
            }`.trim()}
            footer={delta ? <DeltaFooter delta={delta} comparison={comparison} /> : undefined}
            testID="reports-total"
          >
            <Money
              amount={summary.total}
              currency={currency}
              variant="amountLarge"
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          </KpiCard>
          <KpiCard
            label="Entries"
            style={kpiLayout.narrow}
            accessibilityLabel={`${entriesText} on ${daysText}`}
            footer={
              <AppText variant="caption" color="textSecondary">
                {`On ${daysText}`}
              </AppText>
            }
            testID="reports-count"
          >
            <AppText variant="title" tabular numberOfLines={1}>
              {String(summary.count)}
            </AppText>
          </KpiCard>
          <KpiCard
            label="Daily average"
            style={kpiLayout.narrow}
            accessibilityLabel={`Daily average ${formatAmountShort(average, currency)} over ${
              countedDays === 1 ? '1 day' : `${countedDays} days`
            }`}
            footer={
              <AppText variant="caption" color="textSecondary">
                {countedDays === 1 ? 'Over 1 day' : `Over ${countedDays} days`}
              </AppText>
            }
            testID="reports-average"
          >
            <AppText variant="title" tabular numberOfLines={1} adjustsFontSizeToFit>
              {formatAmountShort(average, currency)}
            </AppText>
          </KpiCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Daily spend" />
          <Card>
            <DailySpendChart
              days={days}
              currency={currency}
              period={period}
              today={isCurrentMonth ? todayIso : null}
              testID="reports-daily-chart"
            />
          </Card>
        </View>

        <ListGroup title="By expense type" separatorInset={LIST_TEXT_INSET} testID="reports-by-type">
          {summary.byCategory.map((row, index) => (
            <BreakdownRow
              key={`${row.category}:${index}`}
              leading={<CategoryTile name={row.category} icon={row.icon} />}
              title={row.category || 'Other'}
              amount={row.total}
              total={summary.total}
              count={row.count}
              currency={currency}
            />
          ))}
        </ListGroup>

        {isAdmin ? (
          <ListGroup title="By person" separatorInset={LIST_TEXT_INSET} testID="reports-by-person">
            {summary.byMember.map(row => (
              <BreakdownRow
                key={row.userId}
                leading={<Avatar name={row.name} email={row.email} />}
                title={row.name || row.email || 'Former member'}
                amount={row.total}
                total={summary.total}
                count={row.count}
                currency={currency}
              />
            ))}
          </ListGroup>
        ) : null}
      </>
    );
  } else if (!error) {
    body = <ReportSkeleton />;
  }

  return (
    <Screen
      scroll
      edges={SIDE_EDGES}
      header={<AppHeader testID="reports-header" />}
      gap={spacing.xxl}
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
      testID="reports-screen"
    >
      <View style={styles.intro}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Reports
        </AppText>
        <MonthStepper
          label={period}
          onPrevious={goPrevious}
          onNext={goNext}
          canGoNext={!isCurrentMonth}
        />
        {isAdmin ? null : (
          <View style={styles.scope}>
            <Icon name="info" size={layout.icon.sm} color={colors.textSecondary} />
            <AppText variant="caption" color="textSecondary" style={styles.scopeText}>
              Includes only your expenses and ones shared with you.
            </AppText>
          </View>
        )}
      </View>
      <ErrorBanner
        message={error?.message}
        kind={error?.kind}
        onRetry={() => {
          load('initial');
        }}
        testID="reports-error"
      />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.md },
  scope: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + spacing.xxs },
  scopeText: { flex: 1 },
  section: { gap: spacing.sm },
});
