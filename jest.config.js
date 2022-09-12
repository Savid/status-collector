import { defaults } from 'jest-config';

export default {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: null,
  testRegex: '/__tests__/.*\\.test\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: [...defaults.moduleFileExtensions, 'ts'],
  moduleNameMapper: {
    '^__mocks__/(.*)$': '<rootDir>/__mocks__/$1',
    '^#app/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  transform: {
    '^.+.ts?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
        isolatedModules: true,
      },
    ],
  },
};
