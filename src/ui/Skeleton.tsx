import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius as radii } from '../theme';

export interface SkeletonProps {
  /** Default '100%'. */
  width?: DimensionValue;
  /** Default 16. */
  height?: number;
  /** Default 8. */
  radius?: number;
  /** Circle of diameter `height`. */
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Placeholder block with a slow pulse (static when reduce motion is on). */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.sm,
  circle = false,
  style,
}: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotion => {
        if (cancelled || reduceMotion) {
          return;
        }
        const step = (toValue: number) =>
          Animated.timing(opacity, {
            toValue,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          });
        animation = Animated.loop(Animated.sequence([step(0.55), step(1)]));
        animation.start();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [opacity]);

  const shape = circle
    ? { width: height, height, borderRadius: height / 2 }
    : { width, height, borderRadius: radius };

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, shape, { opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.skeleton },
});
