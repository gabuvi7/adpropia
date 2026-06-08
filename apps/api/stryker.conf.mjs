export default {
  packageManager: "pnpm",
  plugins: ["@stryker-mutator/vitest-runner", "@stryker-mutator/typescript-checker"],
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  reporters: ["progress", "clear-text", "html"],
  thresholds: {
    high: 60,
    low: 40,
    break: 0
  },
  mutate: [
    "src/common/money/**/*.ts",
    "src/modules/liquidations/calculation/**/*.ts",
    "src/modules/{contracts,properties,payments,liquidations}/**/*.service.ts",
    "src/modules/{contracts,properties,payments,liquidations}/**/*.dto.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.test.ts",
    "!src/**/*.module.ts",
    "!src/**/*.controller.ts",
    "!src/main.ts",
    "!src/common/prisma/**"
  ],
  htmlReporter: {
    fileName: "../../reports/mutation/api/index.html"
  },
  tempDirName: ".stryker-tmp"
};
