/**
 * Read-only parity check: local katalog CSVs vs Synckerja footage bank.
 *
 *   node scripts/catalog-bank/compare-katalog-parity.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage"
 *
 * Never writes. Prints file_key set diffs, scene-count mismatches, and ban diffs.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";

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

const dir = arg("--dir");
const orgId = arg("--org") || DEFAULT_ORG;
if (!dir) throw new Error('butuh --dir "…\\bank-footage"');

loadEnv();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
if (!url || !key || key.startsWith("sbp_")) throw new Error("kredensial tidak cocok");

const dataDir = path.join(dir, "_data");
const clipsCsv = parseCsv(path.join(dataDir, "katalog.csv"));
const scenesCsv = parseCsv(path.join(dataDir, "katalog_scene.csv"));
const bansCsv = fs.existsSync(path.join(dataDir, "tandai.csv"))
  ? parseCsv(path.join(dataDir, "tandai.csv"))
  : [];

const csvClipKeys = new Set(clipsCsv.map((row) => fileKey(row.file)).filter(Boolean));
const csvSceneCounts = new Map();
for (const row of scenesCsv) {
  const key = fileKey(row.file);
  if (!key) continue;
  csvSceneCounts.set(key, (csvSceneCounts.get(key) ?? 0) + 1);
}
const csvBans = new Map();
for (const row of bansCsv) {
  const key = fileKey(row.file);
  const scene = Number(row.scene);
  if (!key || !Number.isFinite(scene)) continue;
  csvBans.set(`${key}|${scene}`, String(row.alasan ?? "").trim());
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const assets = await selectAll(() =>
  supabase
    .from("footage_assets")
    .select("id, file_key, storage_status, media_type, preview_storage_path")
    .eq("organization_id", orgId)
    .is("deleted_at", null),
);

const scenes = await selectAll(() =>
  supabase
    .from("footage_scenes")
    .select("id, asset_id, scene_index, thumb_storage_path")
    .eq("organization_id", orgId),
);

const bans = await selectAll(() =>
  supabase.from("footage_bans").select("id, scene_id, reason").eq("organization_id", orgId),
);

const assetById = new Map(assets.map((row) => [row.id, row]));
const dbClipKeys = new Set(assets.map((row) => fileKey(row.file_key)));
const dbSceneCounts = new Map();
const sceneMeta = new Map();
for (const scene of scenes) {
  const asset = assetById.get(scene.asset_id);
  if (!asset) continue;
  const key = fileKey(asset.file_key);
  dbSceneCounts.set(key, (dbSceneCounts.get(key) ?? 0) + 1);
  sceneMeta.set(scene.id, { file_key: key, scene_index: scene.scene_index });
}

const dbBans = new Map();
for (const ban of bans) {
  const meta = sceneMeta.get(ban.scene_id);
  if (!meta) continue;
  dbBans.set(`${meta.file_key}|${meta.scene_index}`, String(ban.reason ?? "").trim());
}

const onlyCsv = [...csvClipKeys].filter((key) => !dbClipKeys.has(key)).sort();
const onlyDb = [...dbClipKeys].filter((key) => !csvClipKeys.has(key)).sort();
const sceneMismatches = [];
for (const key of new Set([...csvSceneCounts.keys(), ...dbSceneCounts.keys()])) {
  const csvN = csvSceneCounts.get(key) ?? 0;
  const dbN = dbSceneCounts.get(key) ?? 0;
  if (csvN !== dbN) sceneMismatches.push({ file_key: key, csv: csvN, db: dbN });
}
sceneMismatches.sort((a, b) => a.file_key.localeCompare(b.file_key));

const onlyCsvBans = [...csvBans.keys()].filter((id) => !dbBans.has(id)).sort();
const onlyDbBans = [...dbBans.keys()].filter((id) => !csvBans.has(id)).sort();
const reasonDiff = [...csvBans.keys()]
  .filter((id) => dbBans.has(id) && csvBans.get(id) !== dbBans.get(id))
  .sort();

const noPreview = assets.filter((row) => !row.preview_storage_path).map((row) => row.file_key).sort();

console.log("=== parity summary ===");
console.log(`org ${orgId}`);
console.log(`csv clips ${csvClipKeys.size}  scenes ${scenesCsv.length}  bans ${csvBans.size}`);
console.log(`db  clips ${dbClipKeys.size}  scenes ${scenes.length}  bans ${dbBans.size}`);
console.log(`only_csv_clips ${onlyCsv.length}`);
for (const key of onlyCsv) console.log(`  csv ${key}`);
console.log(`only_db_clips ${onlyDb.length}`);
for (const key of onlyDb) console.log(`  db  ${key}`);
console.log(`scene_count_mismatches ${sceneMismatches.length}`);
for (const row of sceneMismatches) console.log(`  ${row.file_key} csv=${row.csv} db=${row.db}`);
console.log(`only_csv_bans ${onlyCsvBans.length}`);
for (const id of onlyCsvBans) console.log(`  csv ${id} | ${csvBans.get(id)}`);
console.log(`only_db_bans ${onlyDbBans.length}`);
for (const id of onlyDbBans) console.log(`  db  ${id} | ${dbBans.get(id)}`);
console.log(`ban_reason_diffs ${reasonDiff.length}`);
for (const id of reasonDiff) console.log(`  ${id} csv=${csvBans.get(id)} db=${dbBans.get(id)}`);
console.log(`clips_without_preview ${noPreview.length}`);
for (const key of noPreview) console.log(`  ${key}`);

const ok =
  onlyCsv.length === 0 &&
  onlyDb.length === 0 &&
  sceneMismatches.length === 0 &&
  onlyCsvBans.length === 0 &&
  onlyDbBans.length === 0;
console.log(ok ? "VERDICT exact_match" : "VERDICT deltas_explained_needed");
process.exit(0);
