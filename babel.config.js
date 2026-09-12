module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 / react-native-worklets: the worklets plugin must stay LAST.
  plugins: ['react-native-worklets/plugin'],
};
