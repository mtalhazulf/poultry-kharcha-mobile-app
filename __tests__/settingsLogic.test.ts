import { biometricRowCopy, iconChoiceLabel } from '../src/components/settings/settingsLogic';

describe('biometricRowCopy', () => {
  it('names the sensor in the title and in a sentence-case subtitle', () => {
    expect(biometricRowCopy('Fingerprint', true)).toEqual({
      title: 'Fingerprint sign-in',
      subtitle: 'Unlock the app with fingerprint instead of your password',
    });
    expect(biometricRowCopy('Face unlock', true)).toEqual({
      title: 'Face unlock sign-in',
      subtitle: 'Unlock the app with face unlock instead of your password',
    });
  });

  it('uses generic copy and explains what to do when unavailable', () => {
    expect(biometricRowCopy('Biometrics', true)).toEqual({
      title: 'Biometric sign-in',
      subtitle: 'Unlock the app with biometrics instead of your password',
    });
    expect(biometricRowCopy('Biometrics', false).subtitle).toBe(
      'Set up fingerprint or face unlock on this phone first',
    );
  });
});

describe('iconChoiceLabel', () => {
  it('turns icon keys into spoken names', () => {
    expect(iconChoiceLabel('hard-hat')).toBe('Hard hat');
    expect(iconChoiceLabel('shopping-cart')).toBe('Shopping cart');
    expect(iconChoiceLabel('egg')).toBe('Egg');
  });
});
