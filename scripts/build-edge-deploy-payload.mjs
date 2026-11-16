import fs from "fs";
import path from "path";

const root = path.resolve("supabase/functions");
const projectId = "wqdzqqshoifwyrltzgvx";

const targets = [
  {
    name: "social-media-scheduler",
    entry: "social-media-scheduler/index.ts",
    entrypoint_path: "supabase/functions/social-media-scheduler/index.ts",
  },
  {
    name: "tiktok-content-scheduler",
    entry: "tiktok-content-scheduler/index.ts",
    entrypoint_path: "supabase/functions/tiktok-content-scheduler/index.ts",
  },
];

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

for (const t of targets) {
  const relFiles = collect(t.entry);
  const files = relFiles.map((rel) => ({
    name: `supabase/functions/${rel}`,
    content: fs.readFileSync(path.join(root, rel), "utf8"),
  }));
  const payload = {
    project_id: projectId,
    name: t.name,
    entrypoint_path: t.entrypoint_path,
    verify_jwt: false,
    files,
  };
  const out = path.resolve(`scripts/edge-deploy-${t.name}.json`);
  fs.writeFileSync(out, JSON.stringify(payload));
  console.log(`${t.name}: ${files.length} files -> ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
}