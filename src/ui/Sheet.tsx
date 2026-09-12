/**
 * Bottom sheet in a transparent Modal (docs/ARCHITECTURE.md §6).
 *
 * Keyboard: keyboard-controller follows keyboards inside Modal windows on
 * Android, so a KeyboardAvoidingView lifts the whole sheet, and the body is a
 * KeyboardAwareScrollView that scrolls the focused input clear of the footer.
 * Its own keyboard padding is cancelled (`extraKeyboardSpace = -height`)
 * because the lifted sheet already sits above the keyboard.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Actions pinned under the body; they stay above the keyboard. */
  footer?: React.ReactNode;
  /** Scrollable, keyboard-aware body. Default true. */
  scroll?: boolean;
  /** Backdrop tap and Android back close the sheet. Default true. */
  dismissible?: boolean;
  /** Close button in the header. Default true. */
  showClose?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const OPEN_MS = 240;
const CLOSE_MS = 180;
const noop = () => undefined;

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  dismissible = true,
  showClose = true,
  contentStyle,
  testID,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardVisible = useKeyboardState(state => state.isVisible);
  const keyboardHeight = useKeyboardState(state => state.height);

  const [progress] = useState(() => new Animated.Value(0));
  // Stay mounted while the close animation runs.
  const [rendered, setRendered] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setRendered(true);
    }
  }

  const [sheetHeight, setSheetHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);

  useEffect(() => {
    if (!rendered) {
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? OPEN_MS : CLOSE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) {
        setRendered(false);
      }
    });
    return () => animation.stop();
  }, [visible, rendered, progress]);

  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setSheetHeight(prev => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);

  const onFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setFooterHeight(prev => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);

  const translateY = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sheetHeight > 0 ? sheetHeight + insets.bottom : windowHeight, 0],
      }),
    [progress, sheetHeight, insets.bottom, windowHeight],
  );

  const bottomPad = spacing.lg + (keyboardVisible ? 0 : insets.bottom);
  const bodyStyle: StyleProp<ViewStyle> = [
    styles.body,
    { paddingBottom: footer ? spacing.lg : bottomPad },
    contentStyle,
  ];
  const hasHeader = Boolean(title || subtitle || showClose);

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismissible ? onClose : noop}
    >
      <View style={styles.root} testID={testID}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            disabled={!dismissible}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={[styles.avoider, { paddingTop: insets.top + spacing.xxl }]}
        >
          <Animated.View
            onLayout={onSheetLayout}
            style={[styles.sheet, { transform: [{ translateY }] }]}
          >
            <View
              style={styles.handle}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />

            {hasHeader ? (
              <View style={styles.header}>
                <View style={styles.headerText}>
                  {title ? (
                    <AppText variant="title" accessibilityRole="header" numberOfLines={2}>
                      {title}
                    </AppText>
                  ) : null}
                  {subtitle ? (
                    <AppText variant="callout" color="textSecondary" numberOfLines={3}>
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
                {showClose ? (
                  <IconButton
                    icon="x"
                    variant="tonal"
                    size="sm"
                    accessibilityLabel="Close"
                    onPress={onClose}
                  />
                ) : null}
              </View>
            ) : null}

            {scroll ? (
              <KeyboardAwareScrollView
                style={styles.scroll}
                contentContainerStyle={bodyStyle}
                keyboardShouldPersistTaps="handled"
                bottomOffset={(footer ? footerHeight : 0) + spacing.lg}
                extraKeyboardSpace={-keyboardHeight}
              >
                {children}
              </KeyboardAwareScrollView>
            ) : (
              <View style={bodyStyle}>{children}</View>
            )}

            {footer ? (
              <View onLayout={onFooterLayout} style={[styles.footer, { paddingBottom: bottomPad }]}>
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { backgroundColor: colors.scrim },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, gap: spacing.xs },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.xs, gap: spacing.lg },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
