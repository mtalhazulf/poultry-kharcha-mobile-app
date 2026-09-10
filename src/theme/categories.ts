/**
 * Visual identity for categories. Low-literacy users recognise the icon and
 * colour long before they read the label, so every category gets both.
 */
import { CATEGORIES, type Category } from '../types/models';

export interface CategoryMeta {
  name: string;
  emoji: string;
  /** Soft background behind the emoji. */
  bg: string;
}

const META: Record<Category, Omit<CategoryMeta, 'name'>> = {
  Food: { emoji: '🍽️', bg: '#FFE8D6' },
  Transport: { emoji: '🚌', bg: '#DDEBFF' },
  Groceries: { emoji: '🛒', bg: '#E2F5E1' },
  Bills: { emoji: '💡', bg: '#FFF3C4' },
  Health: { emoji: '💊', bg: '#FFE0E0' },
  Shopping: { emoji: '🛍️', bg: '#F3E3FF' },
  Entertainment: { emoji: '🎬', bg: '#E0F4FF' },
  Education: { emoji: '📚', bg: '#E8E9FF' },
  Rent: { emoji: '🏠', bg: '#E5F0E8' },
  Other: { emoji: '📦', bg: '#ECEEF1' },
};

export function isKnownCategory(name: string): name is Category {
  return (CATEGORIES as readonly string[]).includes(name);
}

/** Icon/colour for any stored category string; custom names fall back to "Other". */
export function getCategoryMeta(name: string): CategoryMeta {
  const key: Category = isKnownCategory(name) ? name : 'Other';
  return { name, ...META[key] };
}

export const CATEGORY_TILES: CategoryMeta[] = CATEGORIES.map(c => ({ name: c, ...META[c] }));
