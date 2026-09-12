import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { colors } from '../theme';

/** Tap anywhere to open the app straight on New Expense. */
export function QuickAddWidget() {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'kharcha://expense/new' }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.surface,
        borderRadius: 16,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <TextWidget
        text="MPS Expense Tracker"
        style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}
      />
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 20,
        }}
      >
        <TextWidget
          text="+  Add expense"
          style={{ fontSize: 15, color: colors.textInverse, fontWeight: '700' }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
