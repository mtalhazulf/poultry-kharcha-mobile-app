import React from 'react';
import { StatusBar } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthProvider';
import { BiometricLockProvider } from './context/BiometricLockProvider';
import { OrgProvider } from './context/OrgProvider';
import RootNavigator from './navigation/RootNavigator';
export default function App() {
  return (
    <SafeAreaProvider>
      {/* Keyboard-aware forms and sticky footers (react-native-keyboard-controller).
          Edge-to-edge is detected automatically, so no translucency props. */}
      <KeyboardProvider>
        <AuthProvider>
          {/* Needs the session from AuthProvider; wraps everything that shows data. */}
          <BiometricLockProvider>
            {/* Memberships and the active organization for the signed-in user. */}
            <OrgProvider>
              {/* RN 0.87 is edge-to-edge on Android: the bar is translucent over the
                  page background (colors.bg), so no backgroundColor prop. */}
              <StatusBar barStyle="dark-content" />
              <RootNavigator />
            </OrgProvider>
          </BiometricLockProvider>
        </AuthProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
