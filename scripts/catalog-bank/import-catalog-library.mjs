/**
 * Import gaya.json, prompt_tetap.json, referensi.json, and shotlist.json.
 *
 * Does not read or write footage, menu, location, or Product Knowledge rows.
 * Video files and photos stay on disk. Run this only after migration
 * 20261122180000 is applied. A later run replaces these four sets.
 *
 *   node scripts/catalog-bank/import-catalog-library.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage" --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const STYLE_KEYS = ["vo", "editing", "teks", "musik", "talent"];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  if (!fs.existsSync(file)) fail(`file tidak ada: ${path.basename(file)}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function textBlocks(source, label, requiredKeys) {
  if (!source || typeof source !== "object" || Array.isArray(source)) fail(`${label} harus objek`);
  const keys = requiredKeys ?? Object.keys(source);
  if (requiredKeys) {
    for (const key of requiredKeys) {
      if (!(key in source)) fail(`${label} kekurangan ${key}`);
    }
  }
  return keys.map((key, position) => {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) fail(`${label} key ${key} tidak valid`);
    const value = source[key];
    const body = Array.isArray(value) ? value.join("\n") : value;
    if (typeof body !== "string" || body.trim() === "") fail(`${label} ${key} kosong`);
    if (Array.isArray(value) && value.some((item) => typeof item !== "string")) fail(`${label} ${key} bukan teks`);
    if (body.length > 4000) fail(`${label} ${key} lebih dari 4000 karakter`);
    return { field_key: key, body, position };
  });
}

function slug(value, label) {
  if (typeof value !== "string" || !SLUG.test(value) || value.length > 80) fail(`${label} bukan slug`);
  return value;
}

function buildCatalog(dir) {
  const dataDir = path.join(path.resolve(dir), "_data");
  const style = textBlocks(readJson(path.join(dataDir, "gaya.json")), "gaya", STYLE_KEYS);
  const promptSource = readJson(path.join(dataDir, "prompt_tetap.json"));
  const prompts = textBlocks(promptSource, "prompt", Object.keys(promptSource));
  const references = readJson(path.join(dataDir, "referensi.json"));
  if (!Array.isArray(references)) fail("referensi.json harus daftar");
  const referenceRows = references.map((item, index) => {
    const externalId = slug(item.id, `referensi ${index + 1}`);
    if (JSON.stringify(item).length > 200000) fail(`referensi ${externalId} terlalu besar`);
    return { external_id: externalId, document: item };
  });
  const jobs = readJson(path.join(dataDir, "shotlist.json"));
  if (!Array.isArray(jobs)) fail("shotlist.json harus daftar");
  const jobRows = jobs.map((item, index) => {
    const externalId = slug(item.job_id, `shot list ${index + 1}`);
    if (!Array.isArray(item.shots)) fail(`shot list ${externalId} tanpa shots`);
    if (JSON.stringify(item).length > 200000) fail(`shot list ${externalId} terlalu besar`);
    return { external_id: externalId, document: item, shot_count: item.shots.length };
  });
  for (const rows of [referenceRows, jobRows]) {
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.external_id)) fail(`id dobel: ${row.external_id}`);
      seen.add(row.external_id);
    }
  }
  return { style, prompts, referenceRows, jobRows };
}

function report(catalog) {
  const beats = catalog.referenceRows.reduce(
    (sum, row) => sum + (Array.isArray(row.document.beats) ? row.document.beats.length : 0),
    0,
  );
  const motions = catalog.referenceRows.reduce(
    (sum, row) => sum + (Array.isArray(row.document.mg) ? row.document.mg.length : 0),
    0,
  );
  console.log(`gaya ${catalog.style.length}`);
  console.log(`prompt ${catalog.prompts.length}`);
  console.log(`referensi ${catalog.referenceRows.length}`);
  console.log(`beat ${beats}`);
  console.log(`motion ${motions}`);
  console.log(`shot list ${catalog.jobRows.length}`);
  console.log(`shot ${catalog.jobRows.reduce((sum, row) => sum + row.shot_count, 0)}`);
}

function loadEnv() {
  const wanted = new Set(["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  for (const file of [".env", ".env.local", "services/mcp/.env", "supabase/.env"]) {
    const full = path.resolve(file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match || !wanted.has(match[1]) || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

async function replaceFields(supabase, table, organizationId, rows) {
  const saved = await must(
    supabase
      .from(table)
      .upsert(
        rows.map((row) => ({
          organization_id: organizationId,
          field_key: row.field_key,
          body: row.body,
          position: row.position,
        })),
        { onConflict: "organization_id,field_key" },
      )
      .select("id, field_key"),
    `simpan ${table}`,
  );
  const keep = new Set(saved.map((row) => row.field_key));
  const existing = await must(
    supabase.from(table).select("id, field_key").eq("organization_id", organizationId),
    `baca ${table}`,
  );
  const gone = existing.filter((row) => !keep.has(row.field_key)).map((row) => row.id);
  if (gone.length === 0) return;
  await must(supabase.from(table).delete().eq("organization_id", organizationId).in("id", gone), `hapus ${table}`);
}

async function replaceDocuments(supabase, table, organizationId, rows) {
  await must(
    supabase
      .from(table)
      .upsert(
        rows.map((row) => ({
          organization_id: organizationId,
          external_id: row.external_id,
          document: row.document,
        })),
        { onConflict: "organization_id,external_id" },
      )
      .select("id"),
    `simpan ${table}`,
  );
  const keep = new Set(rows.map((row) => row.external_id));
  const existing = await must(
    supabase.from(table).select("id, external_id").eq("organization_id", organizationId),
    `baca ${table}`,
  );
  const gone = existing.filter((row) => !keep.has(row.external_id)).map((row) => row.id);
  if (gone.length === 0) return;
  await must(supabase.from(table).delete().eq("organization_id", organizationId).in("id", gone), `hapus ${table}`);
}

async function main() {
  const dir = arg("--dir");
  if (!dir) {
    console.error("Butuh --dir ke folder bank-footage.");
    process.exit(2);
  }
  const organizationId = arg("--org") || DEFAULT_ORG;
  const catalog = buildCatalog(dir);
  report(catalog);
  if (process.argv.includes("--dry-run")) return;

  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.");
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await replaceFields(supabase, "catalog_style_fields", organizationId, catalog.style);
  await replaceFields(supabase, "catalog_prompt_fields", organizationId, catalog.prompts);
  await replaceDocuments(supabase, "catalog_references", organizationId, catalog.referenceRows);
  await replaceDocuments(supabase, "catalog_shot_jobs", organizationId, catalog.jobRows);
  console.log("impor selesai");
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isDirectRun || process.argv[1]?.endsWith("import-catalog-library.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "impor gagal");
    process.exit(1);
  });
}
