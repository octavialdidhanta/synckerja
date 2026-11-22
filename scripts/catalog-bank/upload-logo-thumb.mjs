/**
 * Upload one 240px JPEG made from Logo_Sate_Sultan_PIK2.png.
 * Does not touch other scenes and does not delete anything.
 *
 *   node scripts/catalog-bank/upload-logo-thumb.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage" --jpeg <240.jpg> --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const LOGO_KEY = "_gambar/Logo_Sate_Sultan_PIK2.png";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

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

function jpegSize(buf) {
  let index = 2;
  while (index < buf.length) {
    if (buf[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = buf[index + 1];
    const length = buf.readUInt16BE(index + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buf.readUInt16BE(index + 5), width: buf.readUInt16BE(index + 7) };
    }
    index += 2 + length;
  }
  return null;
}

async function main() {
  const dir = arg("--dir");
  const jpeg = arg("--jpeg");
  if (!dir || !jpeg) fail("Butuh --dir dan --jpeg.");
  const png = path.join(path.resolve(dir), LOGO_KEY);
  if (!fs.existsSync(png)) fail("PNG logo tidak ada.");
  const bytes = fs.readFileSync(jpeg);
  const size = jpegSize(bytes);
  if (!size || size.width !== 240 || size.height !== 240) fail("JPEG logo harus 240x240.");
  if (bytes.length > 5 * 1024 * 1024) fail("JPEG logo lebih dari 5 MB.");

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
    .eq("file_key", LOGO_KEY);
  if (assetError) fail(assetError.message);
  if (!assets || assets.length !== 1) fail(`klip logo harus satu, ketemu ${assets?.length ?? 0}.`);

  const { data: scenes, error: sceneError } = await supabase
    .from("footage_scenes")
    .select("id, scene_index")
    .eq("organization_id", DEFAULT_ORG)
    .eq("asset_id", assets[0].id);
  if (sceneError) fail(sceneError.message);
  if (!scenes || scenes.length !== 1 || scenes[0].scene_index !== 1) fail("scene logo harus satu, index 1.");

  const objectPath = `${DEFAULT_ORG}/thumbs/${scenes[0].id}.jpg`;
  console.log(`org ${DEFAULT_ORG}`);
  console.log("tulis upsert, tanpa hapus");
  console.log(`logo ${LOGO_KEY}`);
  console.log(`scene ${scenes[0].id}`);
  console.log(`path ${objectPath}`);
  if (process.argv.includes("--dry-run")) return;

  const { error: uploadError } = await supabase.storage.from("catalog-media").upload(objectPath, bytes, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (uploadError) fail(uploadError.message);
  const { error: updateError } = await supabase
    .from("footage_scenes")
    .update({ thumb_storage_path: objectPath })
    .eq("id", scenes[0].id)
    .eq("organization_id", DEFAULT_ORG);
  if (updateError) fail(updateError.message);
  console.log("unggah logo selesai");
}

const isDirectRun = process.argv[1]?.endsWith("upload-logo-thumb.mjs");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "unggah gagal");
    process.exit(1);
  });
}
