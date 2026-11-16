import fs from "fs";
import path from "path";

const root = path.resolve("supabase/functions");

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".") && !spec.startsWith("../")) return null;
  const dir = path.dirname(path.join(root, fromFile));
  const tries = spec.match(/\.(ts|tsx|mjs|js)$/)
    ? [spec]
    : [`${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`, `${spec}.mjs`, `${spec}.js`];
  for (const t of tries) {
    const full = path.normalize(path.join(dir, t));
    const rel = path.relative(root, full).split(path.sep).join("/");
    if (fs.existsSync(path.join(root, rel))) return rel;
  }
  return null;
}

function collect(entry) {
  const files = new Set();
  const queue = [entry];
  const importRe = /from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;
  const refRe = /reference\s+path=["']([^"']+)["']/g;
  while (queue.length) {
    const f = queue.pop();
    if (files.has(f)) continue;
    files.add(f);
    const content = fs.readFileSync(path.join(root, f), "utf8");
    for (const re of [importRe, refRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content))) {
        const spec = m[1] || m[2];
        const resolved = resolveImport(f, spec);
        if (resolved) queue.push(resolved);
      }
    }
  }
  return [...files].sort();
}

const entry = process.argv[2];
if (!entry) {
  console.error("usage: node collect-edge-deps.mjs <path-under-functions>");
  process.exit(1);
}
const files = collect(entry);
console.log(JSON.stringify(files));