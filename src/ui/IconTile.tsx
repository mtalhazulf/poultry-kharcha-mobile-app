import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { layout, radius } from '../theme';
import { categoryTint, iconForCategory, type CategoryTint } from '../theme/categories';
import { Icon, type IconName } from './Icon';
import { TONES, type Tone } from './tones';

export type IconTileSize = 'sm' | 'md' | 'lg';

export interface IconTileProps {
  icon: IconName;
  /** Semantic palette. Default 'neutral'. Ignored when `tint` is set. */
  tone?: Tone;
  /** Explicit colors, e.g. from categoryTint(). */
  tint?: CategoryTint;
  /** 32 / 40 / 48. Default 'md'. */
  size?: IconTileSize;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconTileSize, { box: number; icon: number; radius: number }> = {
  sm: { box: layout.tile.sm, icon: layout.icon.sm, radius: radius.sm },
  md: { box: layout.tile.md, icon: layout.icon.md, radius: radius.sm },
  lg: { box: layout.tile.lg, icon: layout.icon.lg, radius: radius.md },
};

/** Rounded square with a centered icon (list leading visual). */
export function IconTile({ icon, tone = 'neutral', tint, size = 'md', style }: IconTileProps) {
  const sizing = SIZES[size];
  const bg = tint?.bg ?? TONES[tone].bg;
  const fg = tint?.fg ?? TONES[tone].icon;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        { width: sizing.box, height: sizing.box, borderRadius: sizing.radius, backgroundColor: bg },
        style,
      ]}
    >
      <Icon name={icon} size={sizing.icon} color={fg} />
    </View>
  );
}

export interface CategoryTileProps {
  /** Category name (drives the tint and the fallback icon). */
  name: string;
  /** Stored icon key (`categories.icon` / `kharcha.category_icon`). */
  icon?: string | null;
  size?: IconTileSize;
  style?: StyleProp<ViewStyle>;
}

/** IconTile for an expense type: resolved icon + stable muted tint. */
export function CategoryTile({ name, icon, size, style }: CategoryTileProps) {
  return (
    <IconTile icon={iconForCategory(name, icon)} tint={categoryTint(name)} size={size} style={style} />
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
