module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.js'],
  clearMocks: true,
  verbose: true,
  coverageProvider: 'babel',
  collectCoverageFrom: [
    'dist/src/**/*.js',
    '!dist/src/main.js',
    '!dist/src/**/*.module.js',
  ],
  coverageThreshold: {
    global: { statements: 85, branches: 85, functions: 85, lines: 85 },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov', 'json-summary'],
};

