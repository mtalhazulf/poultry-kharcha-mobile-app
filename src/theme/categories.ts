/**
 * Visual identity for categories. Low-literacy users recognise the icon and
 * colour long before they read the label, so every category gets both.
 * The emoji comes from the org's category list (or the icon frozen on an
 * expense row); the background colour is derived from the name so it stays
 * stable without any configuration.
 */
import { DEFAULT_CATEGORIES } from '../types/models';

export interface CategoryMeta {
  name: string;
  emoji: string;
  /** Soft background behind the emoji. */
  bg: string;
}

const PALETTE = [
  '#FFE8D6',
  '#DDEBFF',
  '#E2F5E1',
  '#FFF3C4',
  '#FFE0E0',
  '#F3E3FF',
  '#E0F4FF',
  '#E8E9FF',
  '#E5F0E8',
  '#FDE7F3',
] as const;

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(h);
}

export function categoryBg(name: string): string {
  const key = name.trim().toLowerCase();
  return PALETTE[hashName(key) % PALETTE.length] ?? '#ECEEF1';
}

/** Emoji for a category name when no icon is stored (old rows, offline). */
export function defaultEmojiFor(name: string): string {
  const key = name.trim().toLowerCase();
  const hit = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === key);
  return hit?.emoji ?? '📦';
}

/**
 * Icon + colour for a category. Pass the stored `category_icon` when you
 * have it; otherwise the default list is consulted, then a generic box.
 */
export function getCategoryMeta(name: string, icon?: string | null): CategoryMeta {
  return { name, emoji: icon || defaultEmojiFor(name), bg: categoryBg(name) };
}

/** Fallback tiles used before the org list has loaded (or offline). */
export const CATEGORY_TILES: CategoryMeta[] = DEFAULT_CATEGORIES.map(c => ({
  name: c.name,
  emoji: c.emoji,
  bg: categoryBg(c.name),
}));

/** A friendly set of icons the admin can pick from when adding a category. */
export const EMOJI_CHOICES: readonly string[] = [
  '🌾',
  '🐣',
  '🐔',
  '🥚',
  '💊',
  '💉',
  '👷',
  '💡',
  '💧',
  '🚚',
  '🔧',
  '🛠️',
  '🌿',
  '🏠',
  '🧹',
  '🧴',
  '⛽',
  '📦',
  '🧾',
  '💵',
  '🛒',
  '🏗️',
  '📱',
  '🧊',
];
