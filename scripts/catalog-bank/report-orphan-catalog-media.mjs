/**
 * Compare the private catalog-media bucket with paths stored in the database.
 *
 * Dry-run is the default and prints the count and total size. --apply deletes
 * only after --yes-delete-orphans, and only paths this catalog is allowed to
 * store. It never deletes a database row.
 *
 *   node scripts/catalog-bank/report-orphan-catalog-media.mjs
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { allowedCatalogStoragePath } from "./media-retention.mjs";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const BUCKET = "catalog-media";

function loadEnv() {
  const wanted = new Set(["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  for (const file of [".env", ".env.local", "services/mcp/.env", "supabase/.env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match || !wanted.has(match[1]) || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function selectAll(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await makeQuery().range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function remember(paths, value) {
  if (typeof value === "string" && value) paths.add(value);
}

function walkDocument(value, paths) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkDocument(item, paths);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "storage_path" || key === "sample_storage_path" || key === "sheet_storage_path") remember(paths, child);
    else walkDocument(child, paths);
  }
}

async function listFiles(supabase, prefix) {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message);
    const page = data ?? [];
    for (const item of page) {
      const child = prefix ? `${prefix}/${item.name}` : item.name;
      const size = Number(item.metadata?.size ?? 0);
      if (item.id == null || item.metadata == null) files.push(...await listFiles(supabase, child));
      else files.push({ path: child, size });
    }
    if (page.length < 100) return files;
  }
}

loadEnv();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
if (!url || !key || key.startsWith("sbp_")) throw new Error("kredensial tidak cocok");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const known = new Set();

const scenes = await selectAll(() => supabase
  .from("footage_scenes")
  .select("thumb_storage_path")
  .eq("organization_id", DEFAULT_ORG));
for (const row of scenes) remember(known, row.thumb_storage_path);

const assets = await selectAll(() => supabase
  .from("footage_assets")
  .select("thumb_storage_path, preview_storage_path")
  .eq("organization_id", DEFAULT_ORG));
for (const row of assets) {
  remember(known, row.thumb_storage_path);
  remember(known, row.preview_storage_path);
}

for (const table of ["catalog_menu_photos", "catalog_location_photos"]) {
  const photos = await selectAll(() => supabase.from(table).select("storage_path").eq("organization_id", DEFAULT_ORG));
  for (const row of photos) remember(known, row.storage_path);
}

const references = await selectAll(() => supabase
  .from("catalog_references")
  .select("document")
  .eq("organization_id", DEFAULT_ORG));
for (const row of references) walkDocument(row.document, known);

const tombstones = await supabase
  .from("catalog_media_tombstones")
  .select("object_paths")
  .eq("organization_id", DEFAULT_ORG);
if (!tombstones.error) {
  for (const row of tombstones.data ?? []) {
    for (const objectPath of row.object_paths ?? []) remember(known, objectPath);
  }
}

const files = await listFiles(supabase, DEFAULT_ORG);
const orphans = files.filter((file) => !known.has(file.path));
const bytes = orphans.reduce((sum, file) => sum + file.size, 0);
console.log(`objek di bucket ${files.length}`);
console.log(`path di database ${known.size}`);
console.log(`file yatim ${orphans.length}`);
console.log(`ukuran yatim MB ${(bytes / 1024 / 1024).toFixed(1)}`);
for (const file of orphans) console.log(`${file.size} ${file.path}`);

const apply = process.argv.includes("--apply");
if (!apply) {
  console.log("dry-run: tidak ada file yang dihapus");
  process.exit(0);
}
if (!process.argv.includes("--yes-delete-orphans")) {
  throw new Error("hapus yatim butuh --apply dan --yes-delete-orphans");
}
const removable = orphans.map((file) => file.path).filter(allowedCatalogStoragePath);
if (removable.length !== orphans.length) {
  throw new Error("ada path yatim di luar pola catalog-media, tidak ada yang dihapus");
}
if (removable.length === 0) {
  console.log("tidak ada yatim");
  process.exit(0);
}
const { error } = await supabase.storage.from(BUCKET).remove(removable);
if (error) throw new Error(error.message);
console.log(`yatim dihapus ${removable.length}`);
