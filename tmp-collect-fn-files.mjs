import fs from "node:fs";
import path from "node:path";

function collect(entry, seen = new Set()) {
  const abs = path.resolve(entry);
  if (seen.has(abs)) return [];
  seen.add(abs);
  const dir = path.dirname(abs);
  let text;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    return [];
  }
  const rel = path.relative(process.cwd(), abs).replace(/\\/g, "/");
  const out = [{ name: rel, content: text }];
  const re = /from\s+["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    let p = m[1] || m[2];
    if (!p.endsWith(".ts") && !p.endsWith(".js") && !p.endsWith(".tsx") && !p.endsWith(".mjs")) {
      p = `${p}.ts`;
    }
    out.push(...collect(path.resolve(dir, p), seen));
  }
  return out;
}

const fn = process.argv[2];
const files = collect(`supabase/functions/${fn}/index.ts`);
// MCP expects paths relative to function bundle root often as `index.ts` + `_shared/...`
const mapped = files.map((f) => {
  const name = f.name.startsWith(`supabase/functions/${fn}/`)
    ? f.name.slice(`supabase/functions/${fn}/`.length)
    : f.name.startsWith("supabase/functions/")
      ? f.name.slice("supabase/functions/".length)
      : f.name;
  return { name, content: f.content };
});
console.log(JSON.stringify({ fn, count: mapped.length, files: mapped.map((f) => f.name) }, null, 2));
fs.writeFileSync(`tmp-deploy-${fn}.json`, JSON.stringify({ name: fn, files: mapped }));
console.error(`wrote tmp-deploy-${fn}.json bytes=${fs.statSync(`tmp-deploy-${fn}.json`).size}`);
