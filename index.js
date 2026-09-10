/**
 * @format
 */
// Must be the first import: Supabase JS needs a spec-compliant URL in React Native.
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
