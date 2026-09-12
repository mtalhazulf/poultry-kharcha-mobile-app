import {
  CATEGORY_ICON_CHOICES,
  CATEGORY_TINTS,
  DEFAULT_CATEGORY_ICONS,
  categoryTint,
  defaultIconFor,
  iconForCategory,
  isCategoryIcon,
} from '../src/theme/categories';
import { DEFAULT_CATEGORIES } from '../src/types/models';

/** WCAG relative luminance of #RRGGBB. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map(c =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('CATEGORY_ICON_CHOICES', () => {
  it('is the 24 picker icons from the contract, in order', () => {
    expect(CATEGORY_ICON_CHOICES).toEqual(
      'wheat egg bird pill syringe hard-hat users zap droplets flame fuel truck wrench hammer layers warehouse house spray-can shopping-cart receipt banknote phone wifi package'.split(
        ' ',
      ),
    );
  });

  it('uses kebab-case keys with no duplicates', () => {
    expect(new Set(CATEGORY_ICON_CHOICES).size).toBe(24);
    for (const key of CATEGORY_ICON_CHOICES) {
      expect(key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

describe('DEFAULT_CATEGORY_ICONS', () => {
  it('matches the seeded defaults', () => {
    expect(DEFAULT_CATEGORY_ICONS).toEqual({
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
    });
  });

  it('only uses picker icons, so every default can be re-selected', () => {
    for (const icon of Object.values(DEFAULT_CATEGORY_ICONS)) {
      expect(isCategoryIcon(icon)).toBe(true);
    }
  });

  it('agrees with the DEFAULT_CATEGORIES model list', () => {
    expect(DEFAULT_CATEGORIES.map(c => [c.name, c.icon])).toEqual(
      Object.entries(DEFAULT_CATEGORY_ICONS),
    );
    for (const c of DEFAULT_CATEGORIES) {
      expect(iconForCategory(c.name)).toBe(c.icon);
    }
  });
});

describe('iconForCategory', () => {
  it('prefers a known stored icon over the default for that name', () => {
    expect(iconForCategory('Feed', 'bird')).toBe('bird');
    expect(iconForCategory('Feed', ' bird ')).toBe('bird');
  });

  it('falls back to the default for the name when the stored icon is missing or unknown', () => {
    expect(iconForCategory('Feed')).toBe('wheat');
    expect(iconForCategory('Feed', null)).toBe('wheat');
    expect(iconForCategory('Feed', '')).toBe('wheat');
    expect(iconForCategory('Feed', 'car')).toBe('wheat');
    expect(iconForCategory('Medicine', '\u{1F48A}')).toBe('pill');
  });

  it('matches default names case-insensitively and ignores surrounding spaces', () => {
    expect(iconForCategory(' feed ')).toBe('wheat');
    expect(defaultIconFor('MEDICINE')).toBe('pill');
  });

  it('uses package for unknown names', () => {
    expect(iconForCategory('Gifts')).toBe('package');
    expect(iconForCategory('Gifts', 'not-an-icon')).toBe('package');
    expect(defaultIconFor('')).toBe('package');
  });
});

describe('isCategoryIcon', () => {
  it('accepts only picker keys', () => {
    expect(isCategoryIcon('truck')).toBe(true);
    expect(isCategoryIcon('Truck')).toBe(false);
    expect(isCategoryIcon(42)).toBe(false);
    expect(isCategoryIcon(undefined)).toBe(false);
  });
});

describe('categoryTint', () => {
  it('is stable for the same name regardless of case and spacing', () => {
    expect(categoryTint('Gifts')).toEqual(categoryTint('gifts'));
    expect(categoryTint('Gifts')).toEqual(categoryTint('  Gifts '));
    expect(categoryTint('Feed')).toEqual(categoryTint('FEED'));
  });

  it('always returns a palette pair', () => {
    const palette = Object.values(CATEGORY_TINTS);
    for (const name of ['Feed', 'Gifts', 'Diesel', '', 'x', 'A very long custom expense type']) {
      const tint = categoryTint(name);
      expect(tint.fg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(tint.bg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(palette).toContainEqual(tint);
    }
  });

  it('keeps every pair readable (>= 4.5:1)', () => {
    for (const { fg, bg } of Object.values(CATEGORY_TINTS)) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('no emoji', () => {
  it('uses plain ASCII keys everywhere', () => {
    const strings = [
      ...CATEGORY_ICON_CHOICES,
      ...Object.keys(DEFAULT_CATEGORY_ICONS),
      ...Object.values(DEFAULT_CATEGORY_ICONS),
    ];
    for (const s of strings) {
      expect(s).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});
