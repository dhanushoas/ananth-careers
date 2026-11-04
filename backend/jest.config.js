/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\.ts$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'typescript' } } }] },
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.ts', '!src/scripts/**', '!src/server.ts'],
};
