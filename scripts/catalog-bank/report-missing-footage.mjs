/**
 * Compare footage file_key values with the laptop bank.
 *
 * Dry-run is the default. --apply sets storage_status to missing only for
 * files that are not on disk. It never deletes a row or a storage object,
 * and it never changes a clip whose file is present.
 *
 *   node scripts/catalog-bank/report-missing-footage.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage"
 *   node scripts/catalog-bank/report-missing-footage.mjs --dir "..." --apply
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
const apply = process.argv.includes("--apply");
if (!dir) throw new Error("butuh --dir");
loadEnv();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
if (!url || !key || key.startsWith("sbp_")) throw new Error("kredensial tidak cocok");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let rows = [];
let withDeleted = true;
{
  const first = await supabase
    .from("footage_assets")
    .select("id, file_key, storage_status, deleted_at")
    .eq("organization_id", DEFAULT_ORG)
    .limit(1);
  if (first.error) withDeleted = false;
}
rows = await selectAll(() => {
  const query = supabase
    .from("footage_assets")
    .select(withDeleted ? "id, file_key, storage_status, deleted_at" : "id, file_key, storage_status")
    .eq("organization_id", DEFAULT_ORG);
  return withDeleted ? query.is("deleted_at", null) : query;
});

const missing = [];
for (const row of rows) {
  const file = path.join(dir, row.file_key);
  if (!fs.existsSync(file)) missing.push(row);
}

console.log(`klip dicek ${rows.length}`);
console.log(`file asli hilang ${missing.length}`);
for (const row of missing) console.log(`${row.storage_status} ${row.file_key}`);
if (!apply) {
  console.log("dry-run: tidak ada status yang diubah");
  process.exit(0);
}

let marked = 0;
for (const row of missing) {
  if (row.storage_status === "missing") continue;
  const { error } = await supabase
    .from("footage_assets")
    .update({ storage_status: "missing" })
    .eq("organization_id", DEFAULT_ORG)
    .eq("id", row.id)
    .eq("storage_status", row.storage_status);
  if (error) throw new Error(error.message);
  marked += 1;
}
console.log(`ditandai missing ${marked}`);
