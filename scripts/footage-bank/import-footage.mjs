/**
 * Import the Sate Sultan footage CSVs into the footage bank.
 *
 * The CSVs stay the source of truth until MCP starts writing tags.
 * Running this again updates this org's clips, scenes, the four scene tags,
 * usages, and bans. Do not run it after that, or it will overwrite MCP edits.
 *
 * Thumbnails, menu, locations, style, prompts, shot lists, and references
 * are left on disk. The service role key is read from the environment and
 * is never printed.
 *
 *   node scripts/footage-bank/import-footage.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage"
 *   node scripts/footage-bank/import-footage.mjs --dir "..." --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const TAGS = [
  { key: "hijab", label: "Hijab", position: 1 },
  { key: "watermark_ui", label: "Watermark/UI", position: 2 },
  { key: "lengkuas", label: "Lengkuas", position: 3 },
  { key: "meja_biru", label: "Meja biru", position: 4 },
];
const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

function blank(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseCsv(file) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushField();
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) {
    pushField();
    pushRow();
  }
  const header = rows.shift() ?? [];
  return rows.map((cells) => {
    const record = {};
    header.forEach((name, index) => {
      record[name] = cells[index] ?? "";
    });
    return record;
  });
}

function fileKey(value) {
  return String(value ?? "").trim().replace(/\\/g, "/");
}

function originOf(asal) {
  const value = String(asal ?? "").trim().toLowerCase();
  if (value === "ai" || value === "foto" || value === "hp") return value;
  throw new Error(`asal tidak dikenal: ${asal}`);
}

function mediaTypeOf(key) {
  const ext = path.extname(key).toLowerCase();
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  throw new Error(`ekstensi tidak dikenal: ${key}`);
}

function jakartaTime(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) throw new Error(`waktu larangan tidak dikenal: ${value}`);
  return `${match[1]}T${match[2]}:${match[3] ?? "00"}+07:00`;
}

/** Same rules as katalog.py html(): notes are joined, then searched as written. */
function sceneFlags(clipNote, sceneNote, isi, hijab) {
  const notes = `${clipNote ?? ""} ${sceneNote ?? ""}`;
  const hijabValue = String(hijab ?? "").trim();
  if (hijabValue !== "ya" && hijabValue !== "tidak") {
    throw new Error(`hijab tidak dikenal: ${hijab}`);
  }
  return {
    hijab: hijabValue === "ya",
    watermark_ui: notes.includes("TikTok") || notes.includes("UI kamera") || notes.includes("teks"),
    lengkuas: !(`${isi ?? ""}`.includes("tanpa lengkuas") || `${clipNote ?? ""}`.includes("tanpa taburan")),
    meja_biru: `${sceneNote ?? ""}`.includes("meja biru"),
  };
}

function canonNumber(value) {
  const text = String(value ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  return text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function buildCatalog(dir) {
  const dataDir = path.join(dir, "_data");
  const clips = parseCsv(path.join(dataDir, "katalog.csv"));
  const sceneRows = parseCsv(path.join(dataDir, "katalog_scene.csv"));
  const usageRows = parseCsv(path.join(dataDir, "_used_footage.csv"));
  const banRows = parseCsv(path.join(dataDir, "tandai.csv"));

  const assets = clips.map((row) => {
    const key = fileKey(row.file);
    if (!key) throw new Error("baris klip tanpa file");
    return {
      file_key: key,
      media_type: mediaTypeOf(key),
      origin: originOf(row.asal),
      location_label: blank(row.lokasi),
      product_label: blank(row.produk),
      summary: blank(row.shot),
      note: blank(row.catatan),
      duration_seconds: blank(row.durasi_s),
      storage_status: key.startsWith("INBOX/") ? "inbox" : "bank",
    };
  });

  const byFile = new Map();
  const byBase = new Map();
  for (const asset of assets) {
    if (byFile.has(asset.file_key)) throw new Error(`file klip ganda: ${asset.file_key}`);
    byFile.set(asset.file_key, asset);
    const base = path.basename(asset.file_key);
    if (byBase.has(base) && byBase.get(base) !== asset.file_key) {
      throw new Error(`nama file klip ganda: ${base}`);
    }
    byBase.set(base, asset.file_key);
  }

  const scenes = sceneRows.map((row) => {
    const key = fileKey(row.file);
    if (!byFile.has(key)) throw new Error(`scene tanpa klip: ${key}`);
    const sceneIndex = Number(row.scene);
    if (!Number.isInteger(sceneIndex) || sceneIndex < 1) {
      throw new Error(`nomor scene tidak dikenal: ${key} ${row.scene}`);
    }
    const start = blank(row.mulai);
    const end = blank(row.selesai);
    if (start == null || Number(start) < 0) throw new Error(`mulai tidak dikenal: ${key}`);
    if (end != null && Number(end) < Number(start)) throw new Error(`selesai sebelum mulai: ${key}`);
    const sceneKind = blank(row.jenis);
    if (!sceneKind) throw new Error(`jenis scene kosong: ${key}`);
    return {
      file_key: key,
      scene_index: sceneIndex,
      start_seconds: start,
      end_seconds: end,
      scene_kind: sceneKind,
      summary: blank(row.isi),
      note: blank(row.catatan_scene),
      flags: sceneFlags(byFile.get(key).note, row.catatan_scene, row.isi, row.hijab),
    };
  });

  const sceneKey = new Set();
  for (const scene of scenes) {
    const id = `${scene.file_key}|${scene.scene_index}`;
    if (sceneKey.has(id)) throw new Error(`scene ganda: ${id}`);
    sceneKey.add(id);
  }

  const skippedMusic = [];
  const unmatched = [];
  const usages = [];
  for (const row of usageRows) {
    const source = fileKey(row.source_file);
    if (source.startsWith("MUSIC/") || source.startsWith("MUSIC")) {
      skippedMusic.push(source);
      continue;
    }
    const key = byFile.has(source) ? source : byBase.get(path.basename(source));
    if (!key) {
      unmatched.push({
        source_file: source,
        content_id: row.content_id ?? "",
        video_title: row.video_title ?? "",
      });
      continue;
    }
    const contentId = blank(row.content_id);
    const start = blank(row.in_s);
    const end = blank(row.out_s);
    if (!contentId || start == null || end == null) {
      throw new Error(`pemakaian tidak lengkap: ${source}`);
    }
    usages.push({
      file_key: key,
      external_ref: contentId,
      title: blank(row.video_title),
      in_seconds: start,
      out_seconds: end,
    });
  }

  const bans = banRows.map((row) => {
    const key = fileKey(row.file);
    const sceneIndex = Number(row.scene);
    if (!sceneKey.has(`${key}|${sceneIndex}`)) {
      throw new Error(`larangan tanpa scene: ${key} ${row.scene}`);
    }
    const reason = blank(row.alasan);
    if (!reason) throw new Error(`larangan tanpa alasan: ${key}`);
    return {
      file_key: key,
      scene_index: sceneIndex,
      reason,
      created_at: jakartaTime(row.waktu),
    };
  });

  return { assets, scenes, usages, bans, skippedMusic, unmatched };
}

function summarize(catalog) {
  const count = (key, pred) => catalog.scenes.filter((scene) => pred(scene.flags[key])).length;
  return {
    assets: catalog.assets.length,
    scenes: catalog.scenes.length,
    usages: catalog.usages.length,
    bans: catalog.bans.length,
    music: catalog.skippedMusic.length,
    unmatched: catalog.unmatched.length,
    hijab: count("hijab", Boolean),
    watermark: count("watermark_ui", Boolean),
    meja: count("meja_biru", Boolean),
    lengkuasFalse: count("lengkuas", (value) => !value),
  };
}

function printReport(catalog) {
  const totals = summarize(catalog);
  console.log(`klip ${totals.assets}`);
  console.log(`scene ${totals.scenes}`);
  console.log(`pemakaian ${totals.usages}`);
  console.log(`larangan ${totals.bans}`);
  console.log(`hijab ${totals.hijab}`);
  console.log(`watermark ${totals.watermark}`);
  console.log(`meja ${totals.meja}`);
  console.log(`lengkuas_false ${totals.lengkuasFalse}`);
  console.log(`dilewati_musik ${totals.music}`);
  if (catalog.unmatched.length === 0) {
    console.log("tidak_ketemu 0");
  } else {
    console.log("tidak_ketemu");
    for (const row of catalog.unmatched) {
      console.log(`  ${row.source_file} | ${row.content_id} | ${row.video_title}`);
    }
  }
  return totals;
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

function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function selectOrg(supabase, table, columns, organizationId) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const page =
      (await must(
        supabase
          .from(table)
          .select(columns)
          .eq("organization_id", organizationId)
          .range(from, from + pageSize - 1),
        `baca ${table}`,
      )) ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function removeIds(supabase, table, organizationId, ids) {
  for (const group of chunk(ids, 100)) {
    await must(
      supabase.from(table).delete().eq("organization_id", organizationId).in("id", group),
      `hapus ${table}`,
    );
  }
}

async function applyCatalog(supabase, organizationId, catalog) {
  const assetRows = catalog.assets.map((asset) => ({
    organization_id: organizationId,
    file_key: asset.file_key,
    media_type: asset.media_type,
    origin: asset.origin,
    location_label: asset.location_label,
    product_label: asset.product_label,
    summary: asset.summary,
    note: asset.note,
    duration_seconds: asset.duration_seconds,
    storage_status: asset.storage_status,
  }));
  const assetIds = new Map();
  for (const group of chunk(assetRows, 200)) {
    const saved = await must(
      supabase
        .from("footage_assets")
        .upsert(group, { onConflict: "organization_id,file_key" })
        .select("id,file_key"),
      "upsert klip",
    );
    for (const row of saved) assetIds.set(row.file_key, row.id);
  }

  const sceneRows = catalog.scenes.map((scene) => ({
    organization_id: organizationId,
    asset_id: assetIds.get(scene.file_key),
    scene_index: scene.scene_index,
    start_seconds: scene.start_seconds,
    end_seconds: scene.end_seconds,
    scene_kind: scene.scene_kind,
    summary: scene.summary,
    note: scene.note,
  }));
  if (sceneRows.some((row) => !row.asset_id)) throw new Error("scene kehilangan klip");
  const sceneIds = new Map();
  for (const group of chunk(sceneRows, 200)) {
    const saved = await must(
      supabase
        .from("footage_scenes")
        .upsert(group, { onConflict: "asset_id,scene_index" })
        .select("id,asset_id,scene_index"),
      "upsert scene",
    );
    for (const row of saved) sceneIds.set(`${row.asset_id}|${row.scene_index}`, row.id);
  }

  const keptScenes = new Set(
    catalog.scenes.map((scene) => `${assetIds.get(scene.file_key)}|${scene.scene_index}`),
  );
  const existingScenes = await selectOrg(
    supabase,
    "footage_scenes",
    "id,asset_id,scene_index",
    organizationId,
  );
  await removeIds(
    supabase,
    "footage_scenes",
    organizationId,
    existingScenes
      .filter((row) => !keptScenes.has(`${row.asset_id}|${row.scene_index}`))
      .map((row) => row.id),
  );

  const defs = TAGS.map((tag) => ({
    organization_id: organizationId,
    key: tag.key,
    label: tag.label,
    applies_to: "scene",
    value_type: "bool",
    position: tag.position,
  }));
  const savedDefs = await must(
    supabase
      .from("footage_tag_defs")
      .upsert(defs, { onConflict: "organization_id,key" })
      .select("id,key"),
    "upsert tag",
  );
  const defIds = new Map(savedDefs.map((row) => [row.key, row.id]));
  await must(
    supabase
      .from("footage_tag_values")
      .delete()
      .eq("organization_id", organizationId)
      .in("tag_def_id", [...defIds.values()]),
    "hapus tag lama",
  );
  const tagRows = [];
  for (const scene of catalog.scenes) {
    const sceneId = sceneIds.get(`${assetIds.get(scene.file_key)}|${scene.scene_index}`);
    if (!sceneId) throw new Error(`scene belum tersimpan: ${scene.file_key} ${scene.scene_index}`);
    for (const tag of TAGS) {
      tagRows.push({
        organization_id: organizationId,
        tag_def_id: defIds.get(tag.key),
        scene_id: sceneId,
        value_bool: scene.flags[tag.key],
      });
    }
  }
  for (const group of chunk(tagRows, 400)) {
    await must(supabase.from("footage_tag_values").insert(group), "tulis tag");
  }

  const usageRows = catalog.usages.map((usage) => ({
    organization_id: organizationId,
    asset_id: assetIds.get(usage.file_key),
    external_ref: usage.external_ref,
    title: usage.title,
    in_seconds: usage.in_seconds,
    out_seconds: usage.out_seconds,
  }));
  if (usageRows.some((row) => !row.asset_id)) throw new Error("pemakaian kehilangan klip");
  for (const group of chunk(usageRows, 200)) {
    await must(
      supabase.from("footage_usages").upsert(group, {
        onConflict: "organization_id,asset_id,external_ref,in_seconds,out_seconds",
      }),
      "upsert pemakaian",
    );
  }
  const keptUsages = new Set(
    catalog.usages.map(
      (usage) =>
        `${assetIds.get(usage.file_key)}|${usage.external_ref}|${canonNumber(usage.in_seconds)}|${canonNumber(usage.out_seconds)}`,
    ),
  );
  const existingUsages = await selectOrg(
    supabase,
    "footage_usages",
    "id,asset_id,external_ref,in_seconds,out_seconds",
    organizationId,
  );
  await removeIds(
    supabase,
    "footage_usages",
    organizationId,
    existingUsages
      .filter(
        (row) =>
          !keptUsages.has(
            `${row.asset_id}|${row.external_ref}|${canonNumber(row.in_seconds)}|${canonNumber(row.out_seconds)}`,
          ),
      )
      .map((row) => row.id),
  );

  const banRows = catalog.bans.map((ban) => ({
    organization_id: organizationId,
    scene_id: sceneIds.get(`${assetIds.get(ban.file_key)}|${ban.scene_index}`),
    reason: ban.reason,
    created_at: ban.created_at,
  }));
  if (banRows.some((row) => !row.scene_id)) throw new Error("larangan kehilangan scene");
  for (const group of chunk(banRows, 200)) {
    await must(
      supabase.from("footage_bans").upsert(group, { onConflict: "scene_id" }),
      "upsert larangan",
    );
  }
  const keptBans = new Set(banRows.map((row) => row.scene_id));
  const existingBans = await selectOrg(supabase, "footage_bans", "id,scene_id", organizationId);
  await removeIds(
    supabase,
    "footage_bans",
    organizationId,
    existingBans.filter((row) => !keptBans.has(row.scene_id)).map((row) => row.id),
  );
}

async function main() {
  const dir = arg("--dir");
  if (!dir) {
    console.error("Butuh --dir ke folder bank-footage.");
    process.exit(2);
  }
  const organizationId = arg("--org") || DEFAULT_ORG;
  const catalog = buildCatalog(path.resolve(dir));
  printReport(catalog);
  if (process.argv.includes("--dry-run")) return;

  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.");
    process.exit(2);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await applyCatalog(supabase, organizationId, catalog);
  console.log("impor selesai");
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isDirectRun || process.argv[1]?.endsWith("import-footage.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "impor gagal");
    process.exit(1);
  });
}
