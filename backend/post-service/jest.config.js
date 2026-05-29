module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false, isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/helpers/**/*.ts',
    'src/authMiddleware.ts',
    '!src/**/*.test.ts',
  ],
};
