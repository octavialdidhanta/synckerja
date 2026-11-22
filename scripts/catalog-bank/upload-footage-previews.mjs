/**
 * Encode 480p H.264 previews (about 600 kbps, no audio, faststart) and
 * upload them to the private catalog-media bucket. Image clips and any
 * video whose scenes are all thumb_required = false are skipped. Laptop
 * files stay where they are. Nothing is deleted.
 *
 *   node scripts/catalog-bank/upload-footage-previews.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage" --dry-run
 *   node scripts/catalog-bank/upload-footage-previews.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage" --apply
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const EXPECTED_READY = 181;
const MAX_BYTES = 5 * 1024 * 1024;
const JOBS = 2;
const SCALE =
  "scale=w='if(gt(a,1),-2,trunc(min(480,iw)/2)*2)':h='if(gt(a,1),trunc(min(480,ih)/2)*2,-2)'";

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

function sourcePath(root, fileKey) {
  const parts = String(fileKey).split(/[/\\]/).filter((part) => part && part !== "." && part !== "..");
  return path.join(root, ...parts);
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`${bin} exit ${code}: ${stderr.slice(-400)}`));
    });
  });
}

async function probe(file) {
  const raw = await new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height:format=duration", "-of", "json", file],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe exit ${code}: ${stderr.slice(-400)}`));
    });
  });
  return JSON.parse(raw);
}

function previewPath(organizationId, assetId) {
  return `${organizationId}/previews/${assetId}.mp4`;
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

async function encode(input, output) {
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-vf",
    SCALE,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "600k",
    "-maxrate",
    "900k",
    "-bufsize",
    "1200k",
    "-an",
    "-movflags",
    "+faststart",
    output,
  ]);
}

function assertPreview(info, bytes) {
  const streams = info.streams ?? [];
  const video = streams.filter((stream) => stream.codec_type === "video");
  const audio = streams.filter((stream) => stream.codec_type === "audio");
  if (video.length !== 1 || video[0].codec_name !== "h264") fail("preview bukan H.264.");
  if (audio.length !== 0) fail("preview masih punya audio.");
  const width = Number(video[0].width);
  const height = Number(video[0].height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) > 480) {
    fail(`ukuran preview ${width}x${height} melewati 480p.`);
  }
  if (bytes < 1 || bytes > MAX_BYTES) fail(`ukuran file ${bytes} di luar batas 5 MB.`);
}

async function pool(items, limit, worker) {
  let index = 0;
  async function runWorker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
}

async function main() {
  const dir = arg("--dir");
  if (!dir) fail("Butuh --dir ke folder bank-footage.");
  const organizationId = arg("--org") || DEFAULT_ORG;
  if (organizationId !== DEFAULT_ORG) fail("Unggah ini hanya untuk organisasi Sate Sultan PIK.");
  const apply = process.argv.includes("--apply");
  const root = path.resolve(dir);

  loadEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!url || !key) fail("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.");
  if (key.startsWith("sbp_")) fail("Kunci service role tidak boleh token sbp_.");
  if (url.includes("localhost") || url.includes("127.0.0.1")) fail("URL lokal ditolak.");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const assets = await selectAll(() =>
    supabase
      .from("footage_assets")
      .select("id, file_key, media_type, preview_storage_path, deleted_at")
      .eq("organization_id", organizationId)
      .order("id"),
  );
  const scenes = await selectAll(() =>
    supabase
      .from("footage_scenes")
      .select("asset_id, thumb_required")
      .eq("organization_id", organizationId),
  );
  const scenesByAsset = new Map();
  for (const scene of scenes) {
    const list = scenesByAsset.get(scene.asset_id) ?? [];
    list.push(scene);
    scenesByAsset.set(scene.asset_id, list);
  }

  const skipped = [];
  const ready = [];
  for (const asset of assets) {
    if (asset.deleted_at) {
      skipped.push({ fileKey: asset.file_key, reason: "terhapus" });
      continue;
    }
    if (asset.media_type !== "video") {
      skipped.push({ fileKey: asset.file_key, reason: "bukan video" });
      continue;
    }
    const ownScenes = scenesByAsset.get(asset.id) ?? [];
    if (ownScenes.length > 0 && ownScenes.every((scene) => scene.thumb_required === false)) {
      skipped.push({ fileKey: asset.file_key, reason: "draft tanpa thumbnail" });
      continue;
    }
    const objectPath = previewPath(organizationId, asset.id);
    ready.push({
      id: asset.id,
      fileKey: asset.file_key,
      source: sourcePath(root, asset.file_key),
      objectPath,
      already: asset.preview_storage_path === objectPath,
    });
  }

  const missing = ready.filter((item) => !fs.existsSync(item.source));
  console.log(`org ${organizationId}`);
  console.log("tulis upsert, tanpa hapus");
  console.log(`video siap ${ready.length}`);
  console.log(`sudah punya preview ${ready.filter((item) => item.already).length}`);
  console.log(`sumber hilang ${missing.length}`);
  for (const item of skipped) console.log(`dilewati ${item.reason}: ${item.fileKey}`);
  if (ready.length !== EXPECTED_READY) fail(`siap ${ready.length}, yang disetujui ${EXPECTED_READY}.`);
  if (missing.length > 0) fail("Ada klip yang file aslinya tidak ada di laptop.");
  if (!apply) {
    console.log("dry-run, tidak encode dan tidak unggah");
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "synckerja-previews-"));
  let uploaded = 0;
  let skippedExisting = 0;
  let uploadedBytes = 0;
  const failures = [];
  let finished = 0;

  await pool(ready, JOBS, async (item) => {
    if (item.already) {
      skippedExisting += 1;
      finished += 1;
      console.log(`${finished}/${ready.length} sudah ada ${item.fileKey}`);
      return;
    }
    const output = path.join(tempDir, `${item.id}.mp4`);
    try {
      await encode(item.source, output);
      const bytes = fs.statSync(output).size;
      const info = await probe(output);
      assertPreview(info, bytes);
      const body = fs.readFileSync(output);
      const { error: uploadError } = await supabase.storage.from("catalog-media").upload(item.objectPath, body, {
        upsert: true,
        contentType: "video/mp4",
      });
      if (uploadError) fail(uploadError.message);
      const { data, error: updateError } = await supabase
        .from("footage_assets")
        .update({ preview_storage_path: item.objectPath })
        .eq("id", item.id)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .select("id");
      if (updateError) fail(updateError.message);
      if (!data || data.length !== 1) fail("path preview tidak tersimpan.");
      uploaded += 1;
      uploadedBytes += bytes;
      finished += 1;
      console.log(`${finished}/${ready.length} unggah ${(bytes / 1024 / 1024).toFixed(2)} MB ${item.fileKey}`);
    } catch (error) {
      failures.push({ fileKey: item.fileKey, message: error instanceof Error ? error.message : "gagal" });
      finished += 1;
      console.log(`${finished}/${ready.length} gagal ${item.fileKey}`);
    } finally {
      fs.rmSync(output, { force: true });
    }
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log(`terunggah ${uploaded}`);
  console.log(`sudah ada sebelumnya ${skippedExisting}`);
  console.log(`byte terunggah ${uploadedBytes}`);
  console.log(`gagal ${failures.length}`);
  for (const failure of failures) console.log(`gagal ${failure.fileKey}: ${failure.message}`);
  if (failures.length > 0) process.exitCode = 1;
}

const isDirectRun = process.argv[1]?.endsWith("upload-footage-previews.mjs");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "unggah gagal");
    process.exit(1);
  });
}
