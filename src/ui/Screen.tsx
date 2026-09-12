/**
 * Standard screen container (docs/ARCHITECTURE.md §6).
 *
 * - Top/left/right safe area through the native SafeAreaView, which pads only
 *   real overlap (a no-op under a native header).
 * - The bottom inset goes into the content or the footer, except inside the
 *   bottom tab navigator, whose tab bar already covers it.
 * - `keyboard`: KeyboardAwareScrollView keeps the focused input above the
 *   keyboard and above the sticky footer; the footer rides the keyboard in a
 *   KeyboardStickyView and drops its inset padding while the keyboard is up.
 */
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import React, { useCallback, useContext, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type RefreshControlProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../theme';

type SafeEdge = 'top' | 'right' | 'bottom' | 'left';

export interface ScreenProps {
  children?: React.ReactNode;
  /** Scrollable content (ScrollView). */
  scroll?: boolean;
  /** Form mode: keyboard-aware scrolling and a footer above the keyboard. Implies scroll. */
  keyboard?: boolean;
  /** Fixed content above the scroll area (e.g. AppHeader). */
  header?: React.ReactNode;
  /** Sticky bottom bar for primary actions, with a hairline top border. */
  footer?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** 16dp side padding plus top/bottom breathing room. Default true. */
  padded?: boolean;
  /** Vertical gap between direct children. Default 20. */
  gap?: number;
  /** Content container style (scroll content, or the inner View). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Outer container style. */
  style?: StyleProp<ViewStyle>;
  /** 'bg' light gray (default) or 'surface' white. */
  background?: 'bg' | 'surface';
  /** Edges padded by the container. Default top, left, right (bottom is handled inside). */
  edges?: ReadonlyArray<SafeEdge>;
  /** Space kept between the focused input and the keyboard or footer. Default 16. */
  keyboardOffset?: number;
  /** Extra ScrollView props (onScroll, ref-free options). */
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle' | 'refreshControl'>;
  testID?: string;
}

const DEFAULT_EDGES: ReadonlyArray<SafeEdge> = ['top', 'left', 'right'];

export function Screen({
  children,
  scroll = false,
  keyboard = false,
  header,
  footer,
  refreshControl,
  padded = true,
  gap = spacing.xl,
  contentStyle,
  style,
  background = 'bg',
  edges = DEFAULT_EDGES,
  keyboardOffset = spacing.lg,
  scrollProps,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const bottomInset = tabBarHeight === undefined ? insets.bottom : 0;

  const [footerHeight, setFooterHeight] = useState(0);
  const onFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setFooterHeight(prev => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);

  const hasFooter = Boolean(footer);
  const scrolls = scroll || keyboard;
  const endPadding = (padded ? (scrolls ? spacing.xxl : spacing.lg) : 0) + (hasFooter ? 0 : bottomInset);
  const contentLayout: StyleProp<ViewStyle> = [
    padded ? styles.padded : null,
    { gap, paddingBottom: endPadding },
    contentStyle,
  ];

  let body: React.ReactNode;
  if (keyboard) {
    body = (
      <KeyboardAwareScrollView
        style={styles.fill}
        contentContainerStyle={[styles.grow, contentLayout]}
        keyboardShouldPersistTaps="handled"
        // Keep the caret clear of the visible part of the footer, not just the keyboard.
        bottomOffset={(hasFooter ? Math.max(footerHeight - bottomInset, 0) : 0) + keyboardOffset}
        // The footer's inset padding hides behind the keyboard; don't pad for it twice.
        extraKeyboardSpace={hasFooter ? -bottomInset : 0}
        refreshControl={refreshControl}
        {...scrollProps}
      >
        {children}
      </KeyboardAwareScrollView>
    );
  } else if (scroll) {
    body = (
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.grow, contentLayout]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  } else {
    body = <View style={[styles.fill, contentLayout]}>{children}</View>;
  }

  const footerBar = hasFooter ? (
    <View
      onLayout={onFooterLayout}
      style={[styles.footer, { paddingBottom: spacing.md + bottomInset }]}
    >
      {footer}
    </View>
  ) : null;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: colors[background] }, style]}
      testID={testID}
    >
      {header}
      {body}
      {footerBar && keyboard ? (
        <KeyboardStickyView offset={{ closed: 0, opened: bottomInset }}>{footerBar}</KeyboardStickyView>
      ) : (
        footerBar
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  padded: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.border,
  },
});
