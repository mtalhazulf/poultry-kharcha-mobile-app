import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { colors } from '../theme';
import type { WidgetRow } from './widgetLogic';

export interface RecentEntriesWidgetProps {
  /** Null means the load failed (offline, no session) rather than genuinely empty. */
  rows: WidgetRow[] | null;
}

const ADD_ACTION = { clickAction: 'OPEN_URI' as const, clickActionData: { uri: 'kharcha://expense/new' } };

function Row({ row }: { row: WidgetRow }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: row.uri }}
      style={{
        width: 'match_parent',
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
        <TextWidget
          text={row.title}
          style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}
        />
        <TextWidget text={row.subtitle} style={{ fontSize: 11, color: colors.textSecondary }} />
      </FlexWidget>
      <TextWidget text={row.amountText} style={{ fontSize: 13, color: colors.text, fontWeight: '600' }} />
    </FlexWidget>
  );
}

export function RecentEntriesWidget({ rows }: RecentEntriesWidgetProps) {
  let body: React.JSX.Element;
  if (rows === null) {
    body = (
      <TextWidget
        text="Open the app to load your expenses"
        style={{ fontSize: 12, color: colors.textSecondary }}
      />
    );
  } else if (rows.length === 0) {
    body = <TextWidget text="No expenses yet" style={{ fontSize: 12, color: colors.textSecondary }} />;
  } else {
    body = (
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        {rows.map(row => (
          <Row key={row.id} row={row} />
        ))}
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.surface,
        borderRadius: 16,
        flexDirection: 'column',
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 28,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextWidget text="Recent" style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '700' }} />
        <FlexWidget
          {...ADD_ACTION}
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget text="+" style={{ fontSize: 14, color: colors.textInverse, fontWeight: '700' }} />
        </FlexWidget>
      </FlexWidget>
      {body}
    </FlexWidget>
  );
}
