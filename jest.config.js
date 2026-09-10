/**
 * Runs with `bun run test` (package.json "test": "jest") and `bunx jest`.
 * Bun only acts as the script runner here — Jest itself executes under Node.
 */
module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
  moduleNameMapper: {
    // Native-only module: values are baked in at build time, so tests get a fixture.
    '^react-native-config$': '<rootDir>/__mocks__/react-native-config.ts',
    // Official in-memory mock shipped with async-storage v3 (its `./jest`
    // export). Mapped to the file directly because the RN preset resolver
    // ignores package `exports`.
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/lib/module/jest/AsyncStorageMock.js',
  },
  // Everything RN-flavoured ships untranspiled ESM/Flow and must go through babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react-native|@react-native|@react-navigation|@supabase)',
  ],
};
