import React, { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { TypographyVariant } from '../theme';
import { CATEGORY_TINTS, type CategoryTint } from '../theme/categories';
import { AppText } from './AppText';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name?: string | null;
  email?: string | null;
  /** Profile photo; falls back to initials if it fails to load. */
  uri?: string | null;
  /** 32 / 40 / 56. Default 'md'. */
  size?: AvatarSize;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<AvatarSize, { box: number; text: TypographyVariant }> = {
  sm: { box: 32, text: 'caption' },
  md: { box: 40, text: 'subhead' },
  lg: { box: 56, text: 'headline' },
};

const PALETTE: readonly CategoryTint[] = Object.values(CATEGORY_TINTS);

/** "Talha Zulfiqar" -> "TZ", "ali@x.com" -> "AL", nothing -> "?". */
export function initialsFor(name?: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = Array.from(words[0] ?? '')[0] ?? '';
    const last = words.length > 1 ? Array.from(words[words.length - 1] ?? '')[0] ?? '' : '';
    return `${first}${last}`.toUpperCase() || '?';
  }
  const local = (email ?? '').trim().split('@')[0] ?? '';
  return local.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

/** Deterministic muted colors for a person (seed: email, else name). */
export function avatarTint(seed: string): CategoryTint {
  const key = seed.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) % 2147483647;
  }
  return PALETTE[Math.abs(h) % PALETTE.length] ?? { fg: '#475467', bg: '#EEF1F5' };
}

export function Avatar({ name, email, uri, size = 'md', accessibilityLabel, style }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const sizing = SIZES[size];
  const label = accessibilityLabel ?? name ?? email ?? undefined;
  const dims = { width: sizing.box, height: sizing.box, borderRadius: sizing.box / 2 };
  const tint = avatarTint(email || name || '');

  return (
    <View
      style={[styles.avatar, dims, { backgroundColor: tint.bg }, style]}
      accessible={Boolean(label)}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {uri && !failed ? (
        <Image source={{ uri }} style={[StyleSheet.absoluteFill, dims]} onError={() => setFailed(true)} />
      ) : (
        <AppText
          variant={sizing.text}
          style={[styles.initials, { color: tint.fg }]}
          maxFontSizeMultiplier={1}
          numberOfLines={1}
        >
          {initialsFor(name, email)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontWeight: '600' },
});
