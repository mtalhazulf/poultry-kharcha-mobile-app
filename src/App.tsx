import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthProvider';
import RootNavigator from './navigation/RootNavigator';
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* RN 0.87 is edge-to-edge on Android: the bar is translucent over the
            page background (colors.background), so no backgroundColor prop. */}
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
