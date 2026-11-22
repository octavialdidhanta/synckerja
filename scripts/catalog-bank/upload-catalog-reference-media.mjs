/**
 * Upload reference beat and motion-graphic images that the catalog document
 * already points at. Laptop thumb and sample paths stay. Other files in
 * _thumbs stay on disk. A later run upserts the same object paths.
 *
 *   node scripts/catalog-bank/upload-catalog-reference-media.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage" --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const MAX_BYTES = 5 * 1024 * 1024;
const BEAT_NAME = /^refb_[a-z0-9]+_\d+\.jpg$/;
const MOTION_NAME = /^refmg_[a-z0-9]+_\d+(?:_sate)?\.jpg$/;
const SHEET_NAME = /^ref_r[1-4]\.jpg$/;

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

function isSceneThumb(fileName) {
  const sceneMatch = /_s(\d+)\.jpg$/i.exec(fileName);
  if (!sceneMatch) return false;
  const stem = fileName.slice(0, fileName.length - sceneMatch[0].length);
  return /_([0-9a-f]{8})(\d*)$/i.test(stem);
}

function sheetFileName(storedPath) {
  const value = String(storedPath ?? "").trim().replace(/\\/g, "/");
  if (value === "") return null;
  if (!value.startsWith("_thumbs/") || value.includes("..")) fail(`sheet bukan file di _thumbs: ${value}`);
  const name = value.slice("_thumbs/".length);
  if (name.includes("/") || !SHEET_NAME.test(name)) fail(`nama sheet tidak dikenal: ${name}`);
  return name;
}

function imageName(storedPath, kind) {
  const value = String(storedPath ?? "").trim().replace(/\\/g, "/");
  if (value === "") return null;
  if (!value.startsWith("_thumbs/") || value.slice("_thumbs/".length).includes("/")) {
    fail(`path ${kind} bukan file di _thumbs: ${value}`);
  }
  const name = value.slice("_thumbs/".length);
  const pattern = kind === "beat" ? BEAT_NAME : MOTION_NAME;
  if (!pattern.test(name)) fail(`nama ${kind} tidak dikenal: ${name}`);
  return name;
}

function planRow(row, thumbDir) {
  const document = row.document;
  if (!document || typeof document !== "object" || Array.isArray(document)) fail(`dokumen ${row.external_id} bukan objek`);
  const beats = Array.isArray(document.beats) ? document.beats : [];
  const motions = Array.isArray(document.mg) ? document.mg : [];
  const items = [];

  beats.forEach((beat, index) => {
    const fileName = imageName(beat?.thumb, "beat");
    if (!fileName) fail(`beat ${row.external_id} ${index} tanpa thumb`);
    items.push({
      list: "beats",
      index,
      field: "storage_path",
      fileName,
      file: path.join(thumbDir, fileName),
    });
  });

  motions.forEach((motion, index) => {
    const fileName = imageName(motion?.thumb, "motion");
    if (!fileName) fail(`motion ${row.external_id} ${index} tanpa thumb`);
    items.push({
      list: "mg",
      index,
      field: "storage_path",
      fileName,
      file: path.join(thumbDir, fileName),
    });
    const sampleName = imageName(motion?.sample, "motion");
    if (!sampleName) return;
    items.push({
      list: "mg",
      index,
      field: "sample_storage_path",
      fileName: sampleName,
      file: path.join(thumbDir, sampleName),
    });
  });

  const sheetName = sheetFileName(document.sheet);
  if (sheetName) {
    items.push({
      list: null,
      index: null,
      field: "sheet_storage_path",
      fileName: sheetName,
      file: path.join(thumbDir, sheetName),
    });
  }

  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.fileName)) fail(`gambar ${item.fileName} dipakai dua kali di ${row.external_id}`);
    seen.add(item.fileName);
    if (!fs.existsSync(item.file)) fail(`file tidak ada: ${item.fileName}`);
  }
  return items;
}

function objectPath(organizationId, externalId, fileName) {
  return `${organizationId}/thumbs/references/${externalId}/${fileName}`;
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

  loadEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!url || !key) fail("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.");
  if (key.startsWith("sbp_")) fail("Kunci service role tidak boleh token sbp_.");

  const thumbDir = path.join(path.resolve(dir), "_thumbs");
  const thumbFiles = walkFiles(thumbDir).filter((file) => file.toLowerCase().endsWith(".jpg"));
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from("catalog_references")
    .select("id, external_id, document")
    .eq("organization_id", organizationId)
    .order("external_id");
  if (error) fail(error.message);

  const rows = data ?? [];
  const planned = [];
  for (const row of rows) {
    for (const item of planRow(row, thumbDir)) {
      planned.push({
        ...item,
        rowId: row.id,
        externalId: row.external_id,
        objectPath: objectPath(organizationId, row.external_id, item.fileName),
      });
    }
  }

  const plannedNames = new Set(planned.map((item) => item.fileName));
  const referenceFiles = thumbFiles.filter((file) => {
    const name = path.basename(file);
    return BEAT_NAME.test(name) || MOTION_NAME.test(name) || SHEET_NAME.test(name);
  });
  const unlinked = referenceFiles.filter((file) => !plannedNames.has(path.basename(file)));
  const unused = thumbFiles
    .map((file) => path.basename(file))
    .filter((name) => !plannedNames.has(name) && !isSceneThumb(name))
    .sort();
  const beats = planned.filter((item) => item.list === "beats").length;
  const motionThumbs = planned.filter((item) => item.list === "mg" && item.field === "storage_path").length;
  const samples = planned.filter((item) => item.field === "sample_storage_path").length;
  const sheets = planned.filter((item) => item.field === "sheet_storage_path").length;

  console.log(`org ${organizationId}`);
  console.log("tulis upsert, tanpa hapus");
  console.log(`dokumen ${rows.length}`);
  console.log(`gambar referensi cocok ${planned.length}`);
  console.log(`beat ${beats}`);
  console.log(`motion ${motionThumbs}`);
  console.log(`contoh sate ${samples}`);
  console.log(`sheet ${sheets}`);
  console.log(`file referensi tanpa dokumen ${unlinked.length}`);
  console.log(`file tetap di laptop ${unused.length}`);
  for (const name of unused) console.log(`tetap ${name}`);
  for (const item of planned) {
    const place = item.list == null ? "sheet" : `${item.list} ${item.index}`;
    console.log(`${item.externalId} ${place} ${item.field} ${item.fileName}`);
  }

  const huge = planned.filter((item) => fs.statSync(item.file).size > MAX_BYTES);
  if (huge.length > 0) fail(`${huge.length} file lebih dari 5 MB`);
  if (unlinked.length > 0) fail(`ada gambar referensi yang tidak terhubung: ${unlinked.map((file) => path.basename(file)).join(", ")}`);
  if (process.argv.includes("--dry-run")) return;

  const byRow = new Map(rows.map((row) => [row.id, structuredClone(row.document)]));
  for (const item of planned) {
    const bytes = fs.readFileSync(item.file);
    const { error: uploadError } = await supabase.storage.from("catalog-media").upload(item.objectPath, bytes, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (uploadError) fail(`gambar ${item.objectPath}: ${uploadError.message}`);
    const document = byRow.get(item.rowId);
    if (item.list == null) {
      document[item.field] = item.objectPath;
      continue;
    }
    const node = document?.[item.list]?.[item.index];
    if (!node || typeof node !== "object") fail(`dokumen ${item.externalId} kehilangan ${item.list} ${item.index}`);
    node[item.field] = item.objectPath;
  }

  for (const row of rows) {
    const document = byRow.get(row.id);
    if (JSON.stringify(document).length > 200000) fail(`dokumen ${row.external_id} lebih dari 200000 karakter`);
    const { error: updateError } = await supabase
      .from("catalog_references")
      .update({ document })
      .eq("id", row.id)
      .eq("organization_id", organizationId);
    if (updateError) fail(`dokumen ${row.external_id}: ${updateError.message}`);
  }

  console.log("unggah referensi selesai");
}

const isDirectRun = process.argv[1]?.endsWith("upload-catalog-reference-media.mjs");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "unggah gagal");
    process.exit(1);
  });
}
