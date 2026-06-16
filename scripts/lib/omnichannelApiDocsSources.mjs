/**
 * Paths that invalidate API_ACCESSIBILITY_DOCS.md when changed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OMNICHANNEL_API_DOCS_ROOT = path.resolve(__dirname, "../..");
export const OMNICHANNEL_API_DOCS_OUT = path.join(
  OMNICHANNEL_API_DOCS_ROOT,
  "API_ACCESSIBILITY_DOCS.md",
);
export const OMNICHANNEL_API_DOCS_GENERATOR = path.join(
  OMNICHANNEL_API_DOCS_ROOT,
  "scripts/generate-omnichannel-api-docs.mjs",
);

export const OMNICHANNEL_API_DOCS_SOURCE_PATHS = [
  path.join(OMNICHANNEL_API_DOCS_ROOT, "supabase/functions/omnichannel-public-api/openapi.yaml"),
  OMNICHANNEL_API_DOCS_GENERATOR,
  path.join(OMNICHANNEL_API_DOCS_ROOT, "supabase/functions/omnichannel-public-api/index.ts"),
  path.join(OMNICHANNEL_API_DOCS_ROOT, "supabase/functions/omnichannel-public-api/handlers"),
  path.join(OMNICHANNEL_API_DOCS_ROOT, "supabase/functions/omnichannel-api-manage/index.ts"),
  path.join(OMNICHANNEL_API_DOCS_ROOT, "supabase/functions/_shared/omnichannelPublicApi"),
];

function collectFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];
  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const full = path.join(targetPath, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

export function getNewestSourceMtimeMs() {
  let max = 0;
  for (const sourcePath of OMNICHANNEL_API_DOCS_SOURCE_PATHS) {
    for (const file of collectFiles(sourcePath)) {
      max = Math.max(max, fs.statSync(file).mtimeMs);
    }
  }
  return max;
}

export function isOmnichannelApiDocsStale() {
  if (!fs.existsSync(OMNICHANNEL_API_DOCS_OUT)) return true;
  const outMtime = fs.statSync(OMNICHANNEL_API_DOCS_OUT).mtimeMs;
  return getNewestSourceMtimeMs() > outMtime;
}

export function isOmnichannelApiDocsSourceFile(filePath) {
  const normalized = path.normalize(filePath);
  return OMNICHANNEL_API_DOCS_SOURCE_PATHS.some((sourcePath) => {
    const normalizedSource = path.normalize(sourcePath);
    if (normalized === normalizedSource) return true;
    if (fs.existsSync(normalizedSource) && fs.statSync(normalizedSource).isDirectory()) {
      return normalized.startsWith(normalizedSource + path.sep);
    }
    return false;
  });
}
