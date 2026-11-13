/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "pnpm",
  testRunner: "command",
  commandRunner: {
    command: "pnpm --filter @cmp/utils test && pnpm --filter @cmp/factory test",
  },
  coverageAnalysis: "off",
  mutate: [
    "packages/utils/src/*.ts",
    "packages/factory/src/*.ts",
    "!**/*.test.ts",
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  reporters: ["clear-text", "progress"],
};

export default config;
