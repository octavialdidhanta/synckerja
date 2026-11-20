#!/usr/bin/env node
/**
 * Compare deployed Edge Function source (downloaded per function by
 * .github/workflows/edge-functions-compare.yml) with supabase/functions/ in the repo.
 *
 * Layout expected:  <remoteRoot>/<slug>/...  (whatever `supabase functions download` wrote)
 * Each deployed function carries its own copy of the shared files it imported at deploy time,
 * so every function is compared on its own.
 *
 * Writes a Markdown report with FILE NAMES AND LINE COUNTS ONLY (repo is public; no code).
 *
 * Usage: node scripts/edge-functions-compare.mjs <remoteRoot> <reportFile> [importDir]
 *   importDir: when given, files of functions that are deployed but missing from the repo
 *   are copied there as supabase/functions/<path>, never overwriting a file the repo has.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const [remoteRoot, reportFile, importDir] = process.argv.slice(2);
const repoFns = "supabase/functions";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Find the "functions root" inside a download: the folder that contains <slug>/index.ts.
function functionsRoot(slugDir, slug) {
  const hit = walk(slugDir).find((p) => p.split(sep).join("/").endsWith(`/${slug}/index.ts`));
  return hit ? dirname(dirname(hit)) : null;
}

function numstat(a, b) {
  try {
    execFileSync("git", ["diff", "--no-index", "--numstat", "--ignore-cr-at-eol", a, b], { encoding: "utf8" });
    return null; // exit 0 = identical
  } catch (e) {
    const line = String(e.stdout || "").trim().split("\n")[0] || "";
    const [add, del] = line.split(/\s+/);
    return { add: Number(add) || 0, del: Number(del) || 0 };
  }
}

const slugs = readdirSync(remoteRoot).filter((d) => statSync(join(remoteRoot, d)).isDirectory()).sort();
const repoSlugs = new Set(
  readdirSync(repoFns).filter((d) => !d.startsWith("_") && existsSync(join(repoFns, d, "index.ts"))),
);

const rows = [];
const sharedDiffs = new Map(); // shared rel path -> Set(slug)
const imported = [];
for (const slug of slugs) {
  const root = functionsRoot(join(remoteRoot, slug), slug);
  if (!root) { rows.push({ slug, status: "download-unreadable", files: [] }); continue; }
  const files = walk(root).map((p) => relative(root, p).split(sep).join("/"));
  const inRepo = repoSlugs.has(slug);
  const diffs = [];
  for (const rel of files) {
    const remoteFile = join(root, rel);
    const repoFile = join(repoFns, rel);
    if (!existsSync(repoFile)) { diffs.push({ rel, kind: "missing-in-repo" }); continue; }
    const ns = numstat(repoFile, remoteFile);
    if (ns) {
      diffs.push({ rel, kind: "differs", ...ns });
      if (!rel.startsWith(`${slug}/`)) {
        if (!sharedDiffs.has(rel)) sharedDiffs.set(rel, new Set());
        sharedDiffs.get(rel).add(slug);
      }
    }
  }
  const own = diffs.filter((d) => d.rel.startsWith(`${slug}/`));
  const status = !inRepo ? "remote-only" : diffs.length === 0 ? "identical" : own.length ? "own-code-differs" : "shared-only-differs";
  rows.push({ slug, status, files: diffs, fileCount: files.length });

  if (importDir && !inRepo) {
    for (const rel of files) {
      if (existsSync(join(repoFns, rel))) continue; // never overwrite repo files
      const dest = join(importDir, repoFns, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(root, rel), dest);
      imported.push(rel);
    }
  }
}

const count = (s) => rows.filter((r) => r.status === s).length;
const L = [];
L.push("# Edge Functions: deployed vs repo");
L.push("");
L.push(`Deployed functions compared: **${rows.length}**`);
L.push("");
L.push("| Status | Count |");
L.push("|---|---|");
for (const s of ["identical", "shared-only-differs", "own-code-differs", "remote-only", "download-unreadable"]) L.push(`| ${s} | ${count(s)} |`);
L.push("");
L.push("## Functions whose own code differs (repo vs deployed)");
L.push("");
for (const r of rows.filter((r) => r.status === "own-code-differs")) {
  const own = r.files.filter((f) => f.rel.startsWith(`${r.slug}/`));
  L.push(`- **${r.slug}**: ${own.map((f) => f.kind === "differs" ? `${f.rel} (+${f.add}/-${f.del})` : `${f.rel} (missing in repo)`).join(", ")}`);
}
L.push("");
L.push("## Shared files that differ (file: functions deployed with a different version)");
L.push("");
for (const [rel, set] of [...sharedDiffs].sort((a, b) => b[1].size - a[1].size)) L.push(`- ${rel}: ${set.size} (${[...set].slice(0, 8).join(", ")}${set.size > 8 ? ", ..." : ""})`);
L.push("");
L.push("## Deployed but not in repo");
L.push("");
for (const r of rows.filter((r) => r.status === "remote-only")) L.push(`- ${r.slug} (${r.fileCount} files)`);
L.push("");
if (count("download-unreadable")) {
  L.push("## Could not read download");
  for (const r of rows.filter((r) => r.status === "download-unreadable")) L.push(`- ${r.slug}`);
  L.push("");
}
if (importDir) {
  L.push(`## Imported into review branch: ${imported.length} files`);
  for (const f of imported) L.push(`- ${f}`);
  L.push("");
}
writeFileSync(reportFile, L.join("\n"));
writeFileSync(reportFile.replace(/\.md$/, ".json"), JSON.stringify({ rows, shared: Object.fromEntries([...sharedDiffs].map(([k, v]) => [k, [...v]])), imported }, null, 1));
console.log(L.slice(0, 12).join("\n"));
