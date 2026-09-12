import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

export interface LoadingViewProps {
  message?: string;
  /** Fill the parent and center. Default true. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function LoadingView({ message, fill = true, style, testID }: LoadingViewProps) {
  return (
    <View
      style={[styles.container, fill ? styles.fill : null, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
      testID={testID}
    >
      <ActivityIndicator color={colors.primary} />
      {message ? (
        <AppText variant="callout" color="textSecondary" align="center">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
  fill: { flex: 1 },
});
