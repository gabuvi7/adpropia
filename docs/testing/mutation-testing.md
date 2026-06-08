# Mutation testing

Mutation testing checks the quality of tests by making small changes to production code and then running the test suite. If the tests still pass, the changed code is reported as a survived mutant. Survived mutants are useful signals that an assertion may be missing or too broad.

## Why API-first

The first mutation testing target is `@adpropia/api`, not the whole monorepo. Mutation runs are slower and noisier than normal unit tests, so the initial scope focuses on backend code with meaningful domain behavior:

- money conversion helpers;
- liquidation calculations;
- rental contract, property, payment, and liquidation services;
- DTO validation logic for those same modules.

This avoids spending mutation runtime on bootstrap, controllers, modules, generated code, or wiring-heavy files before the team has a useful baseline.

## Commands

From the repository root:

```bash
pnpm mutation:api
```

Or from `apps/api`:

```bash
pnpm mutation
```

The HTML report is written to `reports/mutation/api/index.html`.

## Reading survived mutants

A survived mutant means Stryker changed production code and the tests did not fail. Treat it as a prompt to inspect the behavior, not as an automatic bug. Good follow-up questions are:

- Is the changed behavior part of the intended contract?
- Should an existing test assert this more directly?
- Is the mutant equivalent to the original code and therefore not actionable?
- Is the file too integration-heavy for the current mutation scope?

Prefer adding focused tests for real behavioral gaps. Do not add brittle implementation-detail assertions just to kill a mutant.

## Expanding the scope safely

Expand `apps/api/stryker.conf.mjs` in small increments. Add one module or behavior family at a time, run Stryker, and review the signal-to-noise ratio before expanding further.

Good next candidates are pure domain utilities, state machines, and services with stable unit tests. Keep controllers, modules, main/bootstrap files, generated files, and external integration boundaries out of scope unless there is a clear reason to include them.

## Thresholds

The initial mutation thresholds are intentionally lenient and `break` is set to `0`. This lets the team collect a baseline without blocking local or CI workflows. Tighten thresholds only after the current mutation scope has been reviewed and the noisy survivors have been addressed or excluded.

## Runtime expectations

Mutation testing is much slower than normal unit testing. Do not run it on every local edit. Use it before hardening a domain area, before raising confidence on critical calculation logic, or as a periodic quality check.
