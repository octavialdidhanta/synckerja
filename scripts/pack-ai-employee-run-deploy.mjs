/**
 * Build MCP deploy payload for ai-employee-run from the last get_edge_function dump,
 * overlaying local source files for the same relative paths.
 *
 * Usage:
 *   node scripts/pack-ai-employee-run-deploy.mjs <get_edge_function.json> <out.json>
 */
import fs from "node:fs";
import path from "node:path";

const dumpPath = process.argv[2];
const outPath = process.argv[3] || "scripts/edge-deploy-ai-employee-run.json";
if (!dumpPath) {
  console.error("Usage: node scripts/pack-ai-employee-run-deploy.mjs <dump.json> [out.json]");
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const root = path.resolve("supabase/functions");

function shortName(full) {
  const normalized = String(full).replace(/\\/g, "/");
  const marker = "/functions/";
  const idx = normalized.lastIndexOf(marker);
  if (idx >= 0) return normalized.slice(idx + marker.length);
  // Already relative
  if (normalized.startsWith("ai-employee-run/") || normalized.startsWith("_shared/")) return normalized;
  return path.basename(normalized);
}

const files = [];
for (const file of dump.files ?? []) {
  const name = shortName(file.name);
  const local = path.join(root, name);
  const content = fs.existsSync(local)
    ? fs.readFileSync(local, "utf8")
    : String(file.content ?? "");
  files.push({ name, content });
}

const payload = {
  name: "ai-employee-run",
  entrypoint_path: "ai-employee-run/index.ts",
  verify_jwt: false,
  files,
};

fs.writeFileSync(outPath, JSON.stringify(payload));
console.log(JSON.stringify({
  out: outPath,
  fileCount: files.length,
  bytes: fs.statSync(outPath).size,
  overlaid: files.filter((f) => fs.existsSync(path.join(root, f.name))).map((f) => f.name),
}, null, 2));
