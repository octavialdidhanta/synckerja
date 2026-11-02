/**
 * Satu dry run SOP2 untuk Naya lewat jalur server.
 * Tidak menulis content plan. Tidak mencetak secret.
 *
 * SCHEDULED_POSTS_INTERNAL_SECRET dibaca dari environment, lalu
 * services/mcp/.env, lalu .env di root.
 */
import fs from "node:fs";
import path from "node:path";

const URL = "https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/ai-employee-run";
const NAYA_ID = "f90d4b68-598d-40f9-8b8c-5da6a33512d8";
const INSTRUCTION = "Buatkan 1 content plan untuk Sate Sultan PIK minggu depan, tema makan malam keluarga.";

function readDotEnv(file, wanted) {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match || !wanted.has(match[1])) continue;
    if (process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const keys = new Set([
  "SCHEDULED_POSTS_INTERNAL_SECRET",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
]);
readDotEnv("services/mcp/.env", keys);
readDotEnv(".env", keys);

const secret = process.env.SCHEDULED_POSTS_INTERNAL_SECRET || "";
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!secret) {
  console.error("SCHEDULED_POSTS_INTERNAL_SECRET tidak ada di environment atau .env lokal.");
  process.exit(2);
}
if (!anonKey) {
  console.error("Anon key tidak ada.");
  process.exit(2);
}

const response = await fetch(URL, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "x-synckerja-internal-secret": secret,
  },
  body: JSON.stringify({
    employee_id: NAYA_ID,
    instruction: INSTRUCTION,
    dry_run: true,
  }),
});

const text = await response.text();
let body = null;
try {
  body = text ? JSON.parse(text) : null;
} catch {
  body = { error: "non_json", length: text.length };
}

const draft = body && typeof body === "object" ? body.draft ?? null : null;
const safe = {
  http_status: response.status,
  ok: body?.ok ?? null,
  error: typeof body?.error === "string" ? body.error : null,
  dry_run: body?.dry_run ?? null,
  run_id: body?.run_id ?? null,
  model_calls: body?.model_calls ?? null,
  draft: draft
    ? {
      title: draft.title ?? null,
      post_date: draft.post_date ?? null,
      brief: draft.brief ?? null,
      content_pillar_id: draft.content_pillar_id ?? null,
    }
    : null,
};

console.log(JSON.stringify(safe, null, 2));
process.exit(response.ok ? 0 : 1);
