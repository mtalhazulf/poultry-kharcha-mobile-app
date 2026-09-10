/**
 * Whether this device has shown the first-run walkthrough. Kept per device
 * (not per account) — the point is to teach the person holding the phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kharcha:walkthrough:v1';

export async function hasSeenWalkthrough(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'done';
  } catch {
    return false;
  }
}

export async function markWalkthroughSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'done');
  } catch {
    // Non-fatal: worst case the walkthrough shows again next launch.
  }
}

export interface WalkthroughSlide {
  emoji: string;
  title: string;
  text: string;
  /** Soft background behind the emoji. */
  bg: string;
}

export const WALKTHROUGH_SLIDES: readonly WalkthroughSlide[] = [
  {
    emoji: '💰',
    title: 'Welcome to Kharcha',
    text: 'Write down what you spend.\nSee where your money goes.',
    bg: '#E1F3EA',
  },
  {
    emoji: '➕',
    title: 'Add an expense',
    text: 'Tap the big  ＋ Add  button.\nType the amount, then tap what it was for.',
    bg: '#DDEBFF',
  },
  {
    emoji: '📷',
    title: 'Keep the bill',
    text: 'Take a photo of the receipt.\nIt stays safe with the expense.',
    bg: '#FFF3C4',
  },
  {
    emoji: '👥',
    title: 'Share with family',
    text: 'Share an expense using their email.\nThey can see it, not change it.',
    bg: '#F3E3FF',
  },
];
