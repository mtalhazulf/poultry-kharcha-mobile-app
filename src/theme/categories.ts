/**
 * Visual identity for expense types: a lucide icon key plus a muted tint.
 * Icons come from the org's category list (or the key frozen on an expense
 * row); unknown or missing keys fall back to the default for that name, then
 * `package`. Tints are derived from the name so they stay stable with no
 * configuration. No emoji anywhere.
 */

/** The 24 icons an admin can pick for an expense type (docs/ARCHITECTURE.md §2). */
export const CATEGORY_ICON_CHOICES = [
  'wheat',
  'egg',
  'bird',
  'pill',
  'syringe',
  'hard-hat',
  'users',
  'zap',
  'droplets',
  'flame',
  'fuel',
  'truck',
  'wrench',
  'hammer',
  'layers',
  'warehouse',
  'house',
  'spray-can',
  'shopping-cart',
  'receipt',
  'banknote',
  'phone',
  'wifi',
  'package',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_CHOICES)[number];

export const FALLBACK_CATEGORY_ICON: CategoryIconName = 'package';

/** Default expense types and their icons; mirrors the database seed. */
export const DEFAULT_CATEGORY_ICONS: Readonly<Record<string, CategoryIconName>> = {
  Feed: 'wheat',
  Chicks: 'egg',
  Medicine: 'pill',
  Vaccine: 'syringe',
  Labour: 'hard-hat',
  Electricity: 'zap',
  Water: 'droplets',
  Transport: 'truck',
  Equipment: 'wrench',
  Repair: 'hammer',
  Bedding: 'layers',
  Rent: 'warehouse',
  Other: 'package',
};

const CHOICE_SET: ReadonlySet<string> = new Set(CATEGORY_ICON_CHOICES);

const DEFAULT_BY_KEY: ReadonlyMap<string, CategoryIconName> = new Map(
  Object.entries(DEFAULT_CATEGORY_ICONS).map(([name, icon]) => [normalizeName(name), icon]),
);

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function isCategoryIcon(value: unknown): value is CategoryIconName {
  return typeof value === 'string' && CHOICE_SET.has(value);
}

/** Icon for a default category name ("feed", " Feed ") or `package`. */
export function defaultIconFor(name: string): CategoryIconName {
  return DEFAULT_BY_KEY.get(normalizeName(name)) ?? FALLBACK_CATEGORY_ICON;
}

/**
 * Icon key to render for a category. Pass the stored `icon` / `category_icon`
 * when you have it; unknown values (old emoji, typos) are ignored.
 */
export function iconForCategory(name: string, icon?: string | null): CategoryIconName {
  const stored = icon?.trim();
  return isCategoryIcon(stored) ? stored : defaultIconFor(name);
}

// --- Tints --------------------------------------------------------------------

export interface CategoryTint {
  /** Icon / text color. At least 4.5:1 against `bg`. */
  fg: string;
  /** Tile background. */
  bg: string;
}

/** Restrained, desaturated pairs — enterprise, not candy. */
export const CATEGORY_TINTS = {
  slate: { fg: '#475467', bg: '#EEF1F5' },
  green: { fg: '#1F6B4C', bg: '#E8F3EE' },
  teal: { fg: '#1D6670', bg: '#E5F1F2' },
  blue: { fg: '#2F5A96', bg: '#EAF0F8' },
  indigo: { fg: '#4A4A94', bg: '#EDEDF7' },
  plum: { fg: '#763F6B', bg: '#F4EBF2' },
  clay: { fg: '#94433A', bg: '#F7EDEB' },
  ochre: { fg: '#83580F', bg: '#F7F0E2' },
  olive: { fg: '#566521', bg: '#EFF2E4' },
  steel: { fg: '#305F74', bg: '#E8F0F4' },
} as const satisfies Record<string, CategoryTint>;

export type CategoryTintName = keyof typeof CATEGORY_TINTS;

const TINT_ORDER = Object.keys(CATEGORY_TINTS) as CategoryTintName[];

/** Hand-picked tints for the defaults so the seeded list looks intentional. */
const DEFAULT_TINTS: Readonly<Record<string, CategoryTintName>> = {
  feed: 'ochre',
  chicks: 'olive',
  medicine: 'clay',
  vaccine: 'plum',
  labour: 'indigo',
  electricity: 'ochre',
  water: 'blue',
  transport: 'steel',
  equipment: 'slate',
  repair: 'clay',
  bedding: 'green',
  rent: 'teal',
  other: 'slate',
};

function hashName(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(h);
}

/** Stable `{ fg, bg }` for a category name (case and surrounding spaces ignored). */
export function categoryTint(name: string): CategoryTint {
  const key = normalizeName(name);
  const tintName = DEFAULT_TINTS[key] ?? TINT_ORDER[hashName(key) % TINT_ORDER.length] ?? 'slate';
  return CATEGORY_TINTS[tintName];
}
