#!/usr/bin/env node
/**
 * Safety checks before .github/workflows/edge-functions-deploy.yml deploys one Edge Function.
 *
 *   1. verify_jwt must not change: supabase/config.toml (missing entry = CLI default true) must equal
 *      what is deployed now. Flipping false -> true locks out webhooks / public forms; true -> false
 *      opens a function to anonymous callers.
 *   2. No production drift: the deployed copy of the function's OWN folder must equal the repo at
 *      <baseRef> (the commit before this change). If someone edited production directly, deploying
 *      would silently overwrite that code, so we stop and ask for a manual review (or `force`).
 *
 * Usage: node scripts/edge-function-predeploy-check.mjs <slug> <deployedJson> <downloadDir|-> <baseRef>
 *   deployedJson : output of `supabase functions list -o json`
 *   downloadDir  : folder `supabase functions download <slug> --workdir` wrote into, or "-" if the
 *                  function is not deployed yet (first deploy)
 * Exit 0 = safe, 1 = blocked (reason printed). Prints file names only, never code.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const [slug, deployedJson, downloadDir, baseRef] = process.argv.slice(2);
if (!slug || !deployedJson || !downloadDir || !baseRef) {
  console.error("usage: edge-function-predeploy-check.mjs <slug> <deployedJson> <downloadDir|-> <baseRef>");
  process.exit(2);
}

function configVerifyJwt(name) {
  const toml = readFileSync("supabase/config.toml", "utf8");
  let current = null;
  for (const line of toml.split(/\r?\n/)) {
    const header = line.match(/^\[functions\.([^\]]+)\]\s*$/);
    if (header) { current = header[1]; continue; }
    if (/^\[/.test(line)) { current = null; continue; }
    const v = current === name && line.match(/^\s*verify_jwt\s*=\s*(true|false)\s*$/);
    if (v) return v[1] === "true";
  }
  return true; // CLI default
}

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const problems = [];
const list = JSON.parse(readFileSync(deployedJson, "utf8"));
const deployed = (Array.isArray(list) ? list : list.functions ?? []).find((f) => f.slug === slug);

// 1. verify_jwt
const wanted = configVerifyJwt(slug);
if (deployed && deployed.verify_jwt !== wanted) {
  problems.push(
    `verify_jwt would change from ${deployed.verify_jwt} to ${wanted}. ` +
      `Add [functions.${slug}] verify_jwt = ${deployed.verify_jwt} to supabase/config.toml (or change it on purpose).`,
  );
}

// 2. drift of the function's own folder vs the repo before this change
if (deployed && downloadDir !== "-") {
  const entry = walk(downloadDir).find((p) => p.split(sep).join("/").endsWith(`/${slug}/index.ts`));
  if (!entry) {
    problems.push("could not read the deployed source (download layout unknown); review manually");
  } else {
    const root = dirname(entry); // .../<slug>
    const deployedFiles = walk(root).map((p) => relative(root, p).split(sep).join("/"));
    const norm = (s) => s.replace(/\r\n/g, "\n");
    const deployedText = new Map(deployedFiles.map((rel) => [rel, norm(readFileSync(join(root, rel), "utf8"))]));
    const folder = `supabase/functions/${slug}/`;

    // Files of the deployed copy that differ from the repo at `ref` (empty = identical).
    const driftAt = (ref) => {
      let files = [];
      try {
        files = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, folder], { encoding: "utf8" })
          .split("\n").filter(Boolean).map((p) => p.slice(folder.length));
      } catch { return [...deployedText.keys()].map((r) => `${r} (deployed only)`); }
      const out = [];
      for (const [rel, text] of deployedText) {
        if (!files.includes(rel)) { out.push(`${rel} (deployed only)`); continue; }
        const repo = norm(execFileSync("git", ["show", `${ref}:${folder}${rel}`], { encoding: "utf8" }));
        if (repo !== text) out.push(rel);
      }
      return out;
    };

    // Safe if production equals the repo before this change, or ANY earlier repo version of the
    // folder (then nothing that exists only in production would be lost).
    let drift = driftAt(baseRef);
    if (drift.length) {
      const history = execFileSync("git", ["log", "--format=%H", "-n", "200", baseRef, "--", folder], { encoding: "utf8" })
        .split("\n").filter(Boolean);
      if (history.some((sha) => driftAt(sha).length === 0)) drift = [];
    }
    if (drift.length) {
      problems.push(
        `production differs from the repo before this change: ${drift.join(", ")}. ` +
          "Someone changed the deployed code directly; pull it into the repo first " +
          "(edge-functions-compare.yml pull_deployed) or re-run manually with force.",
      );
    }
  }
}

if (problems.length) {
  for (const p of problems) console.log(`::error title=${slug} blocked::${p}`);
  process.exit(1);
}
console.log(`${slug}: safe to deploy (${deployed ? "verify_jwt unchanged, no production drift" : "first deploy"})`);
