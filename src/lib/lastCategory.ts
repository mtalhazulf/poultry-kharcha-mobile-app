/**
 * The expense type last used for a new expense, per organization, so the
 * New Expense form can default to it instead of starting blank every time.
 * Never applied when editing an existing expense — only when creating.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LastCategory {
  name: string;
  icon: string | null;
}

function keyFor(orgId: string): string {
  return `mps:last-category:v1:${orgId}`;
}

export async function getLastCategory(orgId: string): Promise<LastCategory | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(orgId));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as LastCategory).name === 'string' &&
      ((parsed as LastCategory).icon === null || typeof (parsed as LastCategory).icon === 'string')
    ) {
      return parsed as LastCategory;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setLastCategory(orgId: string, category: LastCategory): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(orgId), JSON.stringify(category));
  } catch {
    // Best effort: the form still works without the remembered default.
  }
}
