module.exports = {
  roots: ['<rootDir>/src/client', '<rootDir>/src/service', '<rootDir>/test'],
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  moduleNameMapper: {
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    '^.+\\.(css|sass|scss)$': '<rootDir>/test/styleMock.js',
    '^components/(.*)$': '<rootDir>/src/client/components/$1',
    '^lib/(.*)$': '<rootDir>/src/client/lib/$1',
    '^pages/(.*)$': '<rootDir>/src/client/pages/$1'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/(?!cheerio/)'],
  testMatch: ['**/__tests__/**/*.{test,spec}.[jt]s?(x)']
}
