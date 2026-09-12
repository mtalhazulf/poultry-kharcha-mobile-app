/**
 * First-run walkthrough. Shown once per user (on this device) when they first
 * reach the main tabs, and replayable from Settings.
 *
 * The flag lives in AsyncStorage under `mps:walkthrough:v2:<userId>`. Marking
 * it also updates an in-memory set and notifies subscribers, so the navigator
 * stops treating the user as new right away, and a failed write still counts
 * for the rest of the session.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IconName } from '../ui/Icon';

const KEY_PREFIX = 'mps:walkthrough:v2:';
const SEEN = 'done';

export function walkthroughStorageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

type Listener = (userId: string) => void;

const seenThisSession = new Set<string>();
const listeners = new Set<Listener>();

export async function hasSeenWalkthrough(userId: string): Promise<boolean> {
  if (seenThisSession.has(userId)) {
    return true;
  }
  try {
    return (await AsyncStorage.getItem(walkthroughStorageKey(userId))) === SEEN;
  } catch {
    return false;
  }
}

export async function markWalkthroughSeen(userId: string): Promise<void> {
  if (!seenThisSession.has(userId)) {
    seenThisSession.add(userId);
    listeners.forEach(listener => listener(userId));
  }
  try {
    await AsyncStorage.setItem(walkthroughStorageKey(userId), SEEN);
  } catch {
    // Non-fatal: worst case the walkthrough shows again after a restart.
  }
}

/** Called with the user id whenever a user finishes (or skips) the walkthrough. */
export function subscribeWalkthroughSeen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface WalkthroughSlide {
  key: string;
  icon: IconName;
  title: string;
  text: string;
}

export const WALKTHROUGH_SLIDES: readonly WalkthroughSlide[] = [
  {
    key: 'record',
    icon: 'receipt',
    title: 'Record expenses',
    text: 'Enter the amount, pick the expense type and save. It takes a few seconds.',
  },
  {
    key: 'receipt',
    icon: 'camera',
    title: 'Keep the receipt',
    text: 'Take a photo of the bill or choose one from your gallery. It stays with the expense.',
  },
  {
    key: 'share',
    icon: 'users',
    title: 'Share with your team',
    text: 'Share an expense with people in your organization. They can view it but not change it.',
  },
  {
    key: 'reports',
    icon: 'chart-column',
    title: 'See where money goes',
    text: 'Reports show totals by expense type, by person and over time.',
  },
];
