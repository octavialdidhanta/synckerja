#!/usr/bin/env node
/**
 * CI guard: fail if API_ACCESSIBILITY_DOCS.md would change after regenerate.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";
import {
  OMNICHANNEL_API_DOCS_GENERATOR,
  OMNICHANNEL_API_DOCS_OUT,
  OMNICHANNEL_API_DOCS_ROOT,
} from "./lib/omnichannelApiDocsSources.mjs";

const before = fs.existsSync(OMNICHANNEL_API_DOCS_OUT)
  ? fs.readFileSync(OMNICHANNEL_API_DOCS_OUT, "utf8")
  : "";

execSync(`node "${OMNICHANNEL_API_DOCS_GENERATOR}"`, {
  stdio: "inherit",
  cwd: OMNICHANNEL_API_DOCS_ROOT,
});

const after = fs.readFileSync(OMNICHANNEL_API_DOCS_OUT, "utf8");

if (before !== after) {
  console.error(
    "\n[verify:omnichannel-api-docs] API_ACCESSIBILITY_DOCS.md is out of date.\n" +
      "Run: npm run generate:omnichannel-api-docs\n",
  );
  process.exit(1);
}

console.log("[verify:omnichannel-api-docs] OK");
