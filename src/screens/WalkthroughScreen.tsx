import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useAuth } from '../context/AuthProvider';
import { markWalkthroughSeen, WALKTHROUGH_SLIDES, type WalkthroughSlide } from '../lib/walkthrough';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, layout, radius, spacing } from '../theme';
import { AppText, Button, Icon, Screen } from '../ui';

type Props = RootStackScreenProps<'Walkthrough'>;

/** Hero tile of a slide: larger than list tiles (IconTile tops out at 48). */
const HERO_TILE = 64;
const HERO_ICON = 32;
const DOT = 6;
const DOT_ACTIVE = 20;

/**
 * Four swipeable slides. Shown once per user before the tabs, and as a modal
 * from Settings (`replay`).
 */
export default function WalkthroughScreen({ navigation, route }: Props) {
  const replay = route.params?.replay === true;
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<WalkthroughSlide>>(null);
  const finished = useRef(false);
  const [index, setIndex] = useState(0);
  const last = WALKTHROUGH_SLIDES.length - 1;

  const finish = useCallback(() => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    if (replay && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Tabs');
    }
    // After leaving: the navigator re-lists this screen once the flag flips.
    if (userId) {
      markWalkthroughSeen(userId);
    }
  }, [navigation, replay, userId]);

  const next = useCallback(() => {
    if (index >= last) {
      finish();
      return;
    }
    const target = index + 1;
    listRef.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  }, [finish, index, last]);

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) {
        return;
      }
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(last, page)));
    },
    [width, last],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<WalkthroughSlide> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WalkthroughSlide>) => (
      <View style={[styles.slide, { width }]}>
        <View style={styles.hero}>
          <Icon name={item.icon} size={HERO_ICON} color={colors.primary} />
        </View>
        <View style={styles.slideText}>
          <AppText variant="title" align="center" accessibilityRole="header">
            {item.title}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {item.text}
          </AppText>
        </View>
      </View>
    ),
    [width],
  );

  const onLast = index >= last;

  return (
    <Screen background="surface" padded={false} gap={0} testID="walkthrough">
      <View style={styles.topBar}>
        {onLast ? null : (
          <Button
            title="Skip"
            variant="tertiary"
            size="sm"
            onPress={finish}
            testID="walkthrough-skip"
          />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={WALKTHROUGH_SLIDES}
        extraData={width}
        keyExtractor={slide => slide.key}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={getItemLayout}
        style={styles.list}
      />

      <View style={styles.bottom}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Step ${index + 1} of ${last + 1}`}
        >
          {WALKTHROUGH_SLIDES.map((slide, i) => (
            <View key={slide.key} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
        <Button
          title={onLast ? 'Get started' : 'Next'}
          onPress={next}
          fullWidth
          testID="walkthrough-next"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  list: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingHorizontal: spacing.xxxl,
  },
  hero: {
    width: HERO_TILE,
    height: HERO_TILE,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideText: { gap: spacing.sm, maxWidth: 360 },
  bottom: {
    gap: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.borderStrong },
  dotActive: { width: DOT_ACTIVE, backgroundColor: colors.primary },
});
