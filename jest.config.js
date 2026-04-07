'use strict';

// Start from the jest-expo preset
const preset = require('jest-expo/jest-preset');

module.exports = {
  ...preset,
  testMatch: ['**/__tests__/**/*.test.ts'],
  testEnvironment: 'node',
  // Remove jest-expo's React Native setup file (NativeModules not available in node env)
  setupFiles: (preset.setupFiles ?? []).filter(
    (f) => !String(f).includes('jest-expo/src/preset/setup'),
  ),
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|zustand|react-native-reanimated)',
  ],
};
