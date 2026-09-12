import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastCategory, setLastCategory } from '../src/lib/lastCategory';

describe('getLastCategory / setLastCategory', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is null when nothing was saved yet', async () => {
    expect(await getLastCategory('org-1')).toBeNull();
  });

  it('persists and reads back per organization', async () => {
    await setLastCategory('org-1', { name: 'Feed', icon: 'wheat' });
    await setLastCategory('org-2', { name: 'Water', icon: 'droplets' });
    expect(await getLastCategory('org-1')).toEqual({ name: 'Feed', icon: 'wheat' });
    expect(await getLastCategory('org-2')).toEqual({ name: 'Water', icon: 'droplets' });
  });

  it('allows a null icon', async () => {
    await setLastCategory('org-1', { name: 'Other', icon: null });
    expect(await getLastCategory('org-1')).toEqual({ name: 'Other', icon: null });
  });

  it('ignores corrupted stored data', async () => {
    await AsyncStorage.setItem('mps:last-category:v1:org-1', 'not json');
    expect(await getLastCategory('org-1')).toBeNull();
  });
});
