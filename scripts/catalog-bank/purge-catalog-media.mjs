/**
 * Remove storage objects for catalog media that has been soft-deleted for 30 days,
 * then delete those rows. Dry-run is the default. This does not touch the laptop files.
 *
 * A grace shorter than 30 days is refused against the hosted project.
 *
 *   node scripts/catalog-bank/purge-catalog-media.mjs
 *   node scripts/catalog-bank/purge-catalog-media.mjs --apply
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  CATALOG_MEDIA_GRACE_SECONDS,
  allowedCatalogStoragePath,
  pathsFromPurgeRow,
} from "./media-retention.mjs";

const BUCKET = "catalog-media";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

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

function idsOf(rows) {
  return (rows ?? []).map((row) => row.id);
}

loadEnv();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
if (!url || !key || key.startsWith("sbp_")) throw new Error("kredensial tidak cocok");
const grace = Number(arg("--grace-seconds") ?? CATALOG_MEDIA_GRACE_SECONDS);
if (!Number.isInteger(grace) || grace < 0) throw new Error("grace tidak cocok");
const hosted = url.includes("supabase.co");
if (grace < CATALOG_MEDIA_GRACE_SECONDS && (hosted || !process.argv.includes("--allow-short-grace"))) {
  throw new Error("grace di bawah 30 hari hanya untuk database lokal dengan --allow-short-grace");
}

const apply = process.argv.includes("--apply");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.rpc("mcp_catalog_media_purge_plan", { p_grace_seconds: grace });
if (error) throw new Error(error.message);
const plan = data ?? {};
const groups = ["footage", "menu_photos", "location_photos", "reference_images"];
let files = 0;
const removable = [];
for (const group of groups) {
  const rows = Array.isArray(plan[group]) ? plan[group] : [];
  console.log(`${group} ${rows.length}`);
  for (const row of rows) {
    for (const objectPath of pathsFromPurgeRow(row)) {
      files += 1;
      if (!allowedCatalogStoragePath(objectPath)) throw new Error(`path ditolak ${objectPath}`);
      removable.push(objectPath);
    }
  }
}
console.log(`file storage ${files}`);
if (!apply) {
  console.log("dry-run: tidak ada baris atau file yang dihapus");
  process.exit(0);
}

if (removable.length > 0) {
  const removed = await supabase.storage.from(BUCKET).remove(removable);
  if (removed.error) throw new Error(removed.error.message);
}
const commit = await supabase.rpc("mcp_catalog_media_purge_commit", {
  p_ids: {
    footage: idsOf(plan.footage),
    menu_photos: idsOf(plan.menu_photos),
    location_photos: idsOf(plan.location_photos),
    reference_images: idsOf(plan.reference_images),
  },
  p_grace_seconds: grace,
});
if (commit.error) throw new Error(commit.error.message);
console.log(`baris dihapus ${JSON.stringify(commit.data)}`);
