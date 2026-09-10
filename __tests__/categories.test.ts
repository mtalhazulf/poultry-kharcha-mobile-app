import { categoryBg, defaultEmojiFor, getCategoryMeta } from '../src/theme/categories';
import { DEFAULT_CATEGORIES } from '../src/types/models';

describe('getCategoryMeta', () => {
  it('prefers the icon stored on the row over the default for that name', () => {
    expect(getCategoryMeta('Feed', '🐔').emoji).toBe('🐔');
    expect(getCategoryMeta('Feed', null).emoji).toBe('🌾');
    expect(getCategoryMeta('Feed').emoji).toBe('🌾');
  });

  it('treats an empty stored icon as missing', () => {
    expect(getCategoryMeta('Feed', '').emoji).toBe('🌾');
  });

  it('matches default names case-insensitively and ignores surrounding spaces', () => {
    expect(getCategoryMeta(' feed ').emoji).toBe('🌾');
    expect(defaultEmojiFor('MEDICINE')).toBe('💊');
  });

  it('falls back to a generic box for an unknown name', () => {
    expect(getCategoryMeta('Gifts').emoji).toBe('📦');
    expect(getCategoryMeta('Gifts', null).emoji).toBe('📦');
    expect(defaultEmojiFor('')).toBe('📦');
  });

  it('keeps the name it was given', () => {
    expect(getCategoryMeta('Gifts', '🎁').name).toBe('Gifts');
  });

  it('gives the same background for the same name every time', () => {
    expect(getCategoryMeta('Feed').bg).toBe(getCategoryMeta('Feed', '🐔').bg);
    expect(categoryBg('Feed')).toBe(categoryBg('feed'));
    expect(categoryBg('Feed')).toBe(categoryBg(' Feed '));
    expect(categoryBg('Feed')).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('has unique names', () => {
    const names = DEFAULT_CATEGORIES.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has unique names ignoring case, so the picker never shows two of a kind', () => {
    const lower = DEFAULT_CATEGORIES.map(c => c.name.trim().toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('gives every default an icon, and getCategoryMeta returns that icon', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(getCategoryMeta(c.name).emoji).toBe(c.emoji);
    }
  });
});
