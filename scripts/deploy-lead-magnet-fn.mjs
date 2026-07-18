/**
 * Deploy one edge function via Supabase MCP-compatible payload to stdout for debugging,
 * or via Management API if SUPABASE_ACCESS_TOKEN starts with sbp_.
 *
 * Usage: node scripts/deploy-lead-magnet-fn.mjs <function-name>
 */
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
  const out = [{ abs, rel, content: text }];
  const re = /from\s+["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    let p = m[1] || m[2];
    if (!/\.(ts|js|tsx|mjs)$/.test(p)) p = `${p}.ts`;
    out.push(...collect(path.resolve(dir, p), seen));
  }
  return out;
}

const fn = process.argv[2];
if (!fn) {
  console.error("Usage: node scripts/deploy-lead-magnet-fn.mjs <fn>");
  process.exit(1);
}

const projectRef = "wqdzqqshoifwyrltzgvx";
const token = process.env.SUPABASE_ACCESS_TOKEN || "";
const collected = collect(`supabase/functions/${fn}/index.ts`);
const files = collected.map((f) => {
  let name;
  if (f.rel.startsWith(`supabase/functions/${fn}/`)) {
    name = f.rel.slice(`supabase/functions/${fn}/`.length);
  } else if (f.rel.startsWith("supabase/functions/")) {
    name = f.rel.slice("supabase/functions/".length);
  } else {
    name = f.rel;
  }
  return { name, content: f.content };
});

console.error(`fn=${fn} files=${files.length} token_prefix=${token.slice(0, 4)} token_len=${token.length}`);

if (!token.startsWith("sbp_")) {
  console.error(
    "SUPABASE_ACCESS_TOKEN is missing or not an sbp_ personal access token. Skipping API deploy.",
  );
  fs.writeFileSync(
    `tmp-deploy-${fn}.json`,
    JSON.stringify({ name: fn, verify_jwt: false, files }),
  );
  console.error(`Wrote tmp-deploy-${fn}.json for MCP deploy`);
  process.exit(2);
}

const body = {
  name: fn,
  entrypoint_path: "index.ts",
  verify_jwt: false,
  files,
};

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(fn)}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

const text = await res.text();
console.error(`status=${res.status}`);
console.log(text);
process.exit(res.ok ? 0 : 1);
