/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ["**/test/**/*.[jt]s?(x)", "test/**/*.[jt]s?(x)", "test/*.[jt]s?(x)"]
};