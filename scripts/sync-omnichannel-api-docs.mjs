#!/usr/bin/env node
/**
 * Regenerate API_ACCESSIBILITY_DOCS.md only when openapi / handlers are newer than output.
 */
import { execSync } from "node:child_process";
import {
  isOmnichannelApiDocsStale,
  OMNICHANNEL_API_DOCS_GENERATOR,
  OMNICHANNEL_API_DOCS_OUT,
  OMNICHANNEL_API_DOCS_ROOT,
} from "./lib/omnichannelApiDocsSources.mjs";

if (isOmnichannelApiDocsStale()) {
  execSync(`node "${OMNICHANNEL_API_DOCS_GENERATOR}"`, {
    stdio: "inherit",
    cwd: OMNICHANNEL_API_DOCS_ROOT,
  });
} else {
  console.log(`[omnichannel-api-docs] up to date (${OMNICHANNEL_API_DOCS_OUT})`);
}
