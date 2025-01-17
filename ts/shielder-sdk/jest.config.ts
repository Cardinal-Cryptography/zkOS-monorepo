import { createDefaultEsmPreset, type JestConfigWithTsJest } from "ts-jest";

const presetConfig = createDefaultEsmPreset({
  tsconfig: "tsconfig.test.json"
});

const config: JestConfigWithTsJest = {
  ...presetConfig,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  collectCoverageFrom: ["src/**/*.ts"],
  coveragePathIgnorePatterns: ["src/_generated"],
  transform: {
    ...presetConfig.transform,
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        useESM: true
      }
    ]
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testMatch: ["**/__tests/**/*.test.ts"]
};

export default config;
