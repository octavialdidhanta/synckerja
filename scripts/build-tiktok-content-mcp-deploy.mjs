/**
 * Build MCP deploy_edge_function payloads for TikTok content + scheduler.
 * Usage: node scripts/build-tiktok-content-mcp-deploy.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "supabase", "functions");
const outDir = path.join(process.cwd(), "scripts", ".deploy-temp");
fs.mkdirSync(outDir, { recursive: true });

function collect(entryRel) {
  const seen = new Set();
  const files = [];

  function walk(rel) {
    const normalized = rel.replace(/\\/g, "/");
    if (seen.has(normalized)) return;
    seen.add(normalized);
    const abs = path.join(root, normalized);
    if (!fs.existsSync(abs)) {
      console.error("missing", abs);
      return;
    }
    const content = fs.readFileSync(abs, "utf8");
    files.push({ name: normalized, content });
    const re = /from\s+["'](\.\.?\/[^"']+)["']/g;
    let m;
    while ((m = re.exec(content))) {
      let imp = m[1];
      if (!imp.endsWith(".ts") && !imp.endsWith(".js") && !imp.endsWith(".tsx")) {
        imp += ".ts";
      }
      const fromDir = path.dirname(abs);
      const target = path.normalize(path.join(fromDir, imp));
      const nextRel = path.relative(root, target).replace(/\\/g, "/");
      walk(nextRel);
    }
  }

  walk(entryRel);
  return files;
}

const fns = [
  "tiktok-content-oauth-start",
  "tiktok-content-oauth-callback",
  "tiktok-content-config",
  "tiktok-content-metrics",
  "tiktok-content-comments",
  "tiktok-content-publish",
  "social-media-scheduler",
  "tiktok-content-scheduler",
];

for (const name of fns) {
  const files = collect(`${name}/index.ts`);
  const payload = {
    name,
    entrypoint_path: `${name}/index.ts`,
    verify_jwt: false,
    files,
  };
  const out = path.join(outDir, `mcp-invoke-${name}.json`);
  fs.writeFileSync(out, JSON.stringify(payload));
  console.log(`${name}: ${files.length} files, ${fs.statSync(out).size} bytes`);
}
