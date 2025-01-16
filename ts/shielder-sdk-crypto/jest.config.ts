import { createDefaultEsmPreset, type JestConfigWithTsJest } from "ts-jest";

const presetConfig = createDefaultEsmPreset({});

const config: JestConfigWithTsJest = {
  ...presetConfig,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  testMatch: ["**/__tests/**/*.test.ts"]
};

export default config;
