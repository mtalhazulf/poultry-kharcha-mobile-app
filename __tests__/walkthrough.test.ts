import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hasSeenWalkthrough,
  markWalkthroughSeen,
  subscribeWalkthroughSeen,
  WALKTHROUGH_SLIDES,
  walkthroughStorageKey,
} from '../src/lib/walkthrough';
import { isIconName } from '../src/ui/Icon';

// The seen-set is module state shared by every test here, so each test uses its own user id.

describe('walkthrough flag', () => {
  it('is stored per user under the v2 key', async () => {
    expect(walkthroughStorageKey('u-1')).toBe('mps:walkthrough:v2:u-1');

    expect(await hasSeenWalkthrough('user-a')).toBe(false);
    await markWalkthroughSeen('user-a');

    expect(await AsyncStorage.getItem('mps:walkthrough:v2:user-a')).toBe('done');
    expect(await hasSeenWalkthrough('user-a')).toBe(true);
    expect(await hasSeenWalkthrough('user-b')).toBe(false);
  });

  it('reads a flag saved in an earlier session', async () => {
    await AsyncStorage.setItem(walkthroughStorageKey('user-c'), 'done');
    expect(await hasSeenWalkthrough('user-c')).toBe(true);
  });

  it('ignores the old per-device flag, so everyone sees the new tour once', async () => {
    await AsyncStorage.setItem('kharcha:walkthrough:v1', 'done');
    expect(await hasSeenWalkthrough('user-d')).toBe(false);
  });

  it('notifies subscribers once per user until they unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeWalkthroughSeen(listener);

    await markWalkthroughSeen('user-e');
    await markWalkthroughSeen('user-e');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('user-e');

    unsubscribe();
    await markWalkthroughSeen('user-e2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('still counts as seen for this session when saving fails', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(markWalkthroughSeen('user-f')).resolves.toBeUndefined();
    expect(await hasSeenWalkthrough('user-f')).toBe(true);
    setItem.mockRestore();
  });

  it('treats an unreadable flag as not seen', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('locked'));
    expect(await hasSeenWalkthrough('user-g')).toBe(false);
    getItem.mockRestore();
  });
});

describe('WALKTHROUGH_SLIDES', () => {
  it('has four slides with unique keys and titles and registered icons', () => {
    expect(WALKTHROUGH_SLIDES.map(slide => slide.title)).toEqual([
      'Record expenses',
      'Keep the receipt',
      'Share with your team',
      'See where money goes',
    ]);
    expect(WALKTHROUGH_SLIDES.map(slide => slide.icon)).toEqual([
      'receipt',
      'camera',
      'users',
      'chart-column',
    ]);
    expect(new Set(WALKTHROUGH_SLIDES.map(slide => slide.key)).size).toBe(WALKTHROUGH_SLIDES.length);
    for (const slide of WALKTHROUGH_SLIDES) {
      expect(isIconName(slide.icon)).toBe(true);
      expect(slide.text.length).toBeGreaterThan(0);
      // Sentence case, no exclamation marks.
      expect(`${slide.title} ${slide.text}`).not.toContain('!');
    }
  });
});
