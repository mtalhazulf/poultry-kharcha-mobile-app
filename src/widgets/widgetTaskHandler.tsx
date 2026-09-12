/**
 * Widget rendering entry point, shared by two callers:
 * - the headless task the library invokes on WIDGET_ADDED/UPDATE/RESIZED
 *   (registered from index.js via registerWidgetTaskHandler);
 * - refreshWidget(), called from the app whenever something the widget shows
 *   changed (the Settings view toggle, or an expense create/update/delete).
 */
import React from 'react';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { QuickAddWidget } from './QuickAddWidget';
import { RecentEntriesWidget } from './RecentEntriesWidget';
import { WIDGET_NAME, getWidgetView, loadRecentRows, rowsForHeight } from './widgetLogic';

async function buildWidgetElement(heightDp: number): Promise<React.JSX.Element> {
  const view = await getWidgetView();
  if (view === 'quickAdd') {
    return <QuickAddWidget />;
  }
  const rows = await loadRecentRows(rowsForHeight(heightDp));
  return <RecentEntriesWidget rows={rows} />;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(await buildWidgetElement(props.widgetInfo.height));
      break;
    default:
      break;
  }
}

/** Best-effort: redraws every placed widget instance now, instead of waiting for the next tick. */
export async function refreshWidget(): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: info => buildWidgetElement(info.height),
    });
  } catch {
    // No widget placed, or a transient failure — nothing to surface to the user for this.
  }
}
