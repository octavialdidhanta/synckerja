/**
 * Mark the twenty draft naskah scenes as not needing a thumbnail.
 * Only the Sate Sultan PIK draft clip, only scene_kind draft, only while the
 * path is still empty. Does not delete rows or storage objects.
 *
 *   node scripts/catalog-bank/mark-draft-thumbs-unneeded.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const DRAFT_KEY = "_bukan-broll/Naskah3_Sate_Babi_Jeroan_DRAFT_tanpa_VO.mp4";

function fail(message) {
  throw new Error(message);
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

async function main() {
  loadEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!url || !key) fail("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.");
  if (key.startsWith("sbp_")) fail("Kunci service role tidak boleh token sbp_.");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: assets, error: assetError } = await supabase
    .from("footage_assets")
    .select("id")
    .eq("organization_id", DEFAULT_ORG)
    .eq("file_key", DRAFT_KEY);
  if (assetError) fail(assetError.message);
  if (!assets || assets.length !== 1) fail(`klip draft harus satu, ketemu ${assets?.length ?? 0}.`);

  const { data: scenes, error: sceneError } = await supabase
    .from("footage_scenes")
    .select("id, scene_index, scene_kind, thumb_storage_path, thumb_required")
    .eq("organization_id", DEFAULT_ORG)
    .eq("asset_id", assets[0].id)
    .order("scene_index");
  if (sceneError) fail(sceneError.message);
  const rows = scenes ?? [];
  if (rows.length !== 20) fail(`scene draft harus 20, ketemu ${rows.length}.`);
  if (rows.some((row) => row.scene_kind !== "draft" || row.thumb_storage_path != null)) {
    fail("ada scene draft yang bukan kind draft atau sudah punya thumbnail.");
  }

  console.log(`org ${DEFAULT_ORG}`);
  console.log(`klip ${DRAFT_KEY}`);
  console.log(`scene ${rows.length}`);
  console.log("tulis thumb_required false, tanpa hapus");
  if (process.argv.includes("--dry-run")) return;

  const { error: updateError } = await supabase
    .from("footage_scenes")
    .update({ thumb_required: false })
    .eq("organization_id", DEFAULT_ORG)
    .eq("asset_id", assets[0].id)
    .eq("scene_kind", "draft")
    .is("thumb_storage_path", null);
  if (updateError) fail(updateError.message);
  console.log("tanda selesai");
}

const isDirectRun = process.argv[1]?.endsWith("mark-draft-thumbs-unneeded.mjs");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "tanda gagal");
    process.exit(1);
  });
}
