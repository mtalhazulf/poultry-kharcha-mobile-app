import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { WALKTHROUGH_SLIDES, markWalkthroughSeen, type WalkthroughSlide } from '../lib/walkthrough';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, radius, spacing, touch, typography } from '../theme';

type Props = RootStackScreenProps<'Walkthrough'>;

/**
 * Four swipeable slides: one picture, one sentence each. Shown once after the
 * first sign-in on a device, and replayable from the dashboard's Help button.
 */
export default function WalkthroughScreen({ navigation, route }: Props) {
  const replay = route.params?.replay ?? false;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<WalkthroughSlide>>(null);
  const [index, setIndex] = useState(0);
  const last = WALKTHROUGH_SLIDES.length - 1;

  const finish = useCallback(async () => {
    await markWalkthroughSeen();
    if (replay) {
      navigation.goBack();
    } else {
      navigation.replace('Dashboard');
    }
  }, [navigation, replay]);

  const next = useCallback(() => {
    if (index >= last) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }, [index, last, finish]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(last, page)));
    },
    [width, last],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WalkthroughSlide>) => (
      <View style={[styles.slide, { width }]}>
        <View style={[styles.illustration, { backgroundColor: item.bg }]}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.text}>{item.text}</Text>
      </View>
    ),
    [width],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={finish}
          hitSlop={8}
          style={styles.skip}
          testID="walkthrough-skip"
        >
          <Text style={styles.skipText}>{index < last ? 'Skip' : ''}</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={WALKTHROUGH_SLIDES}
        keyExtractor={s => s.title}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        bounces={false}
      />

      <View style={styles.dots} accessible accessibilityLabel={`Step ${index + 1} of ${last + 1}`}>
        {WALKTHROUGH_SLIDES.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          size="lg"
          icon={index < last ? '👉' : '✅'}
          title={index < last ? 'Next' : 'Start'}
          onPress={next}
          testID="walkthrough-next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: { height: touch.min, alignItems: 'flex-end', justifyContent: 'center' },
  skip: { minHeight: 44, minWidth: 72, justifyContent: 'center', paddingHorizontal: spacing.lg },
  skipText: { ...typography.label, color: colors.primary, fontSize: 17, textAlign: 'right' },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  illustration: {
    width: 200,
    height: 200,
    borderRadius: radius.lg * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 104 },
  title: { ...typography.title, textAlign: 'center' },
  text: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 28 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotActive: { width: 28, backgroundColor: colors.primary },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
});
