module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],
  collectCoverageFrom: ["*.js", "!jest.config.js", "!test/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testMatch: ["<rootDir>/test/**/*.test.js"],
  globals: {
    chrome: {},
  },
};
