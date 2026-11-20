#!/usr/bin/env node
/**
 * Lint "ratchet" for CI.
 *
 * The codebase still has many pre-existing ESLint errors, so a plain `eslint .` would block
 * every PR. Instead this script fails only when the error count goes UP compared to the
 * number saved in .eslint-baseline.json. When a PR lowers the count, it asks you to lower
 * the baseline too, so the limit only ever moves down.
 *
 * Usage:
 *   node scripts/lint-ratchet.mjs           # check against the baseline (CI)
 *   node scripts/lint-ratchet.mjs --update  # write the current count as the new baseline
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const baselinePath = fileURLToPath(new URL("../.eslint-baseline.json", import.meta.url));
const update = process.argv.includes("--update");

const eslint = new ESLint();
const results = await eslint.lintFiles(["."]);
const errors = results.reduce((sum, r) => sum + r.errorCount, 0);
const warnings = results.reduce((sum, r) => sum + r.warningCount, 0);

if (update) {
  writeFileSync(baselinePath, `${JSON.stringify({ errors }, null, 2)}\n`);
  console.log(`[lint-ratchet] baseline set to ${errors} errors (${warnings} warnings).`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).errors;
console.log(`[lint-ratchet] ${errors} errors (baseline ${baseline}), ${warnings} warnings.`);

if (errors > baseline) {
  // Show only the files with errors so the new ones are easy to find in the CI log.
  const formatter = await eslint.loadFormatter("stylish");
  const withErrors = results
    .filter((r) => r.errorCount > 0)
    .map((r) => ({ ...r, messages: r.messages.filter((m) => m.severity === 2), warningCount: 0 }));
  console.log(await formatter.format(withErrors));
  console.error(
    `[lint-ratchet] FAIL: this change adds ${errors - baseline} ESLint error(s). ` +
      "Fix them before merging (run `npx eslint <file>` on the files you changed).",
  );
  process.exit(1);
}

if (errors < baseline) {
  console.log(
    `[lint-ratchet] Nice: ${baseline - errors} fewer error(s). ` +
      "Run `npm run lint:baseline` and commit .eslint-baseline.json to lock in the lower limit.",
  );
}
