module.exports = {
  verbose: true,
  testEnvironment: 'node',
  collectCoverage: !!process.env.TRAVIS || !!process.env.COVERAGE,
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'src/**/*.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '__fixtures__',
    '__mocks__',
    '__tests__',
  ],
  roots: ['<rootDir>/src'],
  setupFiles: [],
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.js',
  ],
};
