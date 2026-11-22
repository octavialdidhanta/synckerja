/**
 * Upload scene thumbnails and catalog photos that already have rows.
 *
 * Does not upload 480p previews, does not change laptop paths, and does not
 * delete storage objects or rows. A later run upserts the same object paths.
 *
 *   node scripts/catalog-bank/upload-catalog-media.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage" --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function fail(message) {
  throw new Error(message);
}

function clipIdentity(fileKey) {
  const base = String(fileKey).split(/[/\\]/).pop() || "";
  const copied = /_([0-9a-f]{8}) \((\d+)\)\.[a-z0-9]+$/i.exec(base);
  if (copied) return { hash: copied[1].toLowerCase(), copy: copied[2] };
  const plain = /_([0-9a-f]{8})\.[a-z0-9]+$/i.exec(base);
  if (plain) return { hash: plain[1].toLowerCase(), copy: "" };
  return null;
}

function thumbIdentity(fileName) {
  const sceneMatch = /_s(\d+)\.jpg$/i.exec(fileName);
  if (!sceneMatch) return null;
  const scene = Number(sceneMatch[1]);
  if (!Number.isInteger(scene) || scene < 1) return null;
  const stem = fileName.slice(0, fileName.length - sceneMatch[0].length);
  const hashMatch = /_([0-9a-f]{8})(\d*)$/i.exec(stem);
  if (!hashMatch) return null;
  return { hash: hashMatch[1].toLowerCase(), copy: hashMatch[2], scene };
}

function mediaKey(identity) {
  return `${identity.hash}:${identity.copy}:${identity.scene}`;
}

function contentType(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
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

async function selectAll(makeQuery) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function matchThumbs(scenes, assets, thumbFiles) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const owners = new Map();
  let clipsWithoutHash = 0;
  for (const asset of assets) {
    const identity = clipIdentity(asset.file_key);
    if (!identity) {
      clipsWithoutHash += 1;
      continue;
    }
    const ownerKey = `${identity.hash}:${identity.copy}`;
    const list = owners.get(ownerKey) ?? [];
    list.push(asset.id);
    owners.set(ownerKey, list);
  }
  const ambiguousOwners = new Set(
    [...owners.entries()].filter(([, ids]) => ids.length > 1).map(([ownerKey]) => ownerKey),
  );
  const sceneByKey = new Map();
  const ambiguousSceneKeys = new Set();
  for (const scene of scenes) {
    const asset = assetById.get(scene.asset_id);
    const identity = asset ? clipIdentity(asset.file_key) : null;
    if (!identity || ambiguousOwners.has(`${identity.hash}:${identity.copy}`)) continue;
    const key = mediaKey({ ...identity, scene: scene.scene_index });
    if (sceneByKey.has(key)) ambiguousSceneKeys.add(key);
    else sceneByKey.set(key, scene);
  }

  const thumbByKey = new Map();
  const duplicateThumbKeys = new Set();
  for (const file of thumbFiles) {
    const identity = thumbIdentity(path.basename(file));
    if (!identity) continue;
    const key = mediaKey(identity);
    if (thumbByKey.has(key)) duplicateThumbKeys.add(key);
    else thumbByKey.set(key, file);
  }

  const matched = [];
  for (const [key, scene] of sceneByKey) {
    if (ambiguousSceneKeys.has(key) || duplicateThumbKeys.has(key)) continue;
    const file = thumbByKey.get(key);
    if (!file) continue;
    matched.push({
      sceneId: scene.id,
      file,
      objectPath: `${scene.organization_id}/thumbs/${scene.id}.jpg`,
    });
  }

  const matchedKeys = new Set(
    matched.map((item) => mediaKey(thumbIdentity(path.basename(item.file)))),
  );
  const scenesWithoutFile = scenes.filter((scene) => {
    const asset = assetById.get(scene.asset_id);
    const identity = asset ? clipIdentity(asset.file_key) : null;
    if (!identity || ambiguousOwners.has(`${identity.hash}:${identity.copy}`)) return true;
    return !matchedKeys.has(mediaKey({ ...identity, scene: scene.scene_index }));
  }).length;
  const filesWithoutScene = thumbFiles.filter((file) => {
    const identity = thumbIdentity(path.basename(file));
    if (!identity) return true;
    return !matchedKeys.has(mediaKey(identity));
  }).length;

  return { matched, scenesWithoutFile, filesWithoutScene, clipsWithoutHash };
}

function matchPhotos(rows, dataDir) {
  const ready = [];
  let missing = 0;
  for (const row of rows) {
    const relative = String(row.file_path).replace(/\\/g, "/");
    const file = path.join(dataDir, relative);
    const ext = path.extname(file).slice(1).toLowerCase();
    if (!fs.existsSync(file) || !PHOTO_EXT.has(ext)) {
      missing += 1;
      continue;
    }
    ready.push({
      id: row.id,
      table: row.table,
      file,
      objectPath: `${row.organization_id}/photos/${row.id}.${ext}`,
      contentType: contentType(ext),
    });
  }
  return { ready, missing };
}

function unreferencedPhotos(dataDir, referenced) {
  const fotoDir = path.join(dataDir, "foto");
  return walkFiles(fotoDir).filter((file) => {
    const relative = path.relative(dataDir, file).split(path.sep).join("/");
    return !referenced.has(relative);
  });
}

function assertSize(files) {
  const huge = files.filter((file) => fs.statSync(file).size > MAX_BYTES);
  if (huge.length === 0) return;
  fail(`${huge.length} file lebih dari 5 MB`);
}

async function main() {
  const dir = arg("--dir");
  if (!dir) {
    console.error("Butuh --dir ke folder bank-footage.");
    process.exit(2);
  }
  const organizationId = arg("--org") || DEFAULT_ORG;
  if (organizationId !== DEFAULT_ORG) {
    console.error("Unggah ini hanya untuk organisasi Sate Sultan PIK.");
    process.exit(2);
  }
  const root = path.resolve(dir);
  const dataDir = path.join(root, "_data");
  const thumbFiles = walkFiles(path.join(root, "_thumbs")).filter((file) => file.toLowerCase().endsWith(".jpg"));

  loadEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!url || !key) fail("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.");
  if (key.startsWith("sbp_")) fail("Kunci service role tidak boleh token sbp_.");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const assets = await selectAll(() =>
    supabase.from("footage_assets").select("id, file_key").eq("organization_id", organizationId),
  );
  const scenes = (
    await selectAll(() =>
      supabase
        .from("footage_scenes")
        .select("id, asset_id, scene_index")
        .eq("organization_id", organizationId),
    )
  ).map((scene) => ({ ...scene, organization_id: organizationId }));
  const menuPhotos = (
    await selectAll(() =>
      supabase.from("catalog_menu_photos").select("id, file_path").eq("organization_id", organizationId),
    )
  ).map((row) => ({ ...row, table: "catalog_menu_photos", organization_id: organizationId }));
  const locationPhotos = (
    await selectAll(() =>
      supabase.from("catalog_location_photos").select("id, file_path").eq("organization_id", organizationId),
    )
  ).map((row) => ({ ...row, table: "catalog_location_photos", organization_id: organizationId }));

  const thumbs = matchThumbs(scenes, assets, thumbFiles);
  const photos = matchPhotos([...menuPhotos, ...locationPhotos], dataDir);
  const referenced = new Set(
    [...menuPhotos, ...locationPhotos].map((row) => String(row.file_path).replace(/\\/g, "/")),
  );
  const extraPhotos = unreferencedPhotos(dataDir, referenced);
  const menuReady = photos.ready.filter((row) => row.table === "catalog_menu_photos").length;
  const locationReady = photos.ready.filter((row) => row.table === "catalog_location_photos").length;

  console.log(`org ${organizationId}`);
  console.log("tulis upsert, tanpa hapus");
  console.log(`thumbnail cocok ${thumbs.matched.length}`);
  console.log(`scene tanpa file ${thumbs.scenesWithoutFile}`);
  console.log(`file tanpa scene ${thumbs.filesWithoutScene}`);
  console.log(`klip tanpa hash ${thumbs.clipsWithoutHash}`);
  console.log(`foto menu ${menuReady}`);
  console.log(`foto lokasi ${locationReady}`);
  console.log(`file foto yang tidak punya baris ${extraPhotos.length}`);
  if (photos.missing > 0) console.log(`foto tercatat tanpa file ${photos.missing}`);

  assertSize([...thumbs.matched.map((item) => item.file), ...photos.ready.map((item) => item.file)]);
  if (process.argv.includes("--dry-run")) return;

  for (const item of thumbs.matched) {
    const bytes = fs.readFileSync(item.file);
    const { error: uploadError } = await supabase.storage.from("catalog-media").upload(item.objectPath, bytes, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (uploadError) fail(`thumbnail ${item.objectPath}: ${uploadError.message}`);
    const { error: updateError } = await supabase
      .from("footage_scenes")
      .update({ thumb_storage_path: item.objectPath })
      .eq("id", item.sceneId)
      .eq("organization_id", organizationId);
    if (updateError) fail(`path scene ${item.sceneId}: ${updateError.message}`);
  }

  for (const item of photos.ready) {
    const bytes = fs.readFileSync(item.file);
    const { error: uploadError } = await supabase.storage.from("catalog-media").upload(item.objectPath, bytes, {
      upsert: true,
      contentType: item.contentType,
    });
    if (uploadError) fail(`foto ${item.objectPath}: ${uploadError.message}`);
    const { error: updateError } = await supabase
      .from(item.table)
      .update({ storage_path: item.objectPath })
      .eq("id", item.id)
      .eq("organization_id", organizationId);
    if (updateError) fail(`path foto ${item.id}: ${updateError.message}`);
  }

  console.log("unggah selesai");
}

const isDirectRun = process.argv[1]?.endsWith("upload-catalog-media.mjs");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "unggah gagal");
    process.exit(1);
  });
}
