/**
 * Uji pintu tulis Naya lewat role ai_employee_runner pada project hosted.
 *
 * Env:
 *   SUPABASE_JWT_SECRET  legacy JWT secret (HS256). Wajib. Tidak dicetak.
 *   SUPABASE_URL         opsional. Default: project hosted.
 *   SUPABASE_ANON_KEY    opsional. Dipakai sebagai header apikey bila gateway
 *                        menolak JWT role kustom di header itu.
 *   NAYA_EMPLOYEE_ID     opsional. Default: employees.id Naya EMP-00002.
 *
 * SUPABASE_JWT_SECRET, URL, dan anon key juga dibaca dari .env di root
 * (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) bila environment belum mengisinya.
 * Jangan memakai awalan VITE_ pada secret. Service role tidak dipakai.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_URL = "https://wqdzqqshoifwyrltzgvx.supabase.co";
const DEFAULT_NAYA_ID = "f90d4b68-598d-40f9-8b8c-5da6a33512d8";

function readDotEnv(file, wanted) {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match || !wanted.has(match[1])) continue;
    const key = match[1];
    if (process.env[key]) continue;
    process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

readDotEnv(".env", new Set(["SUPABASE_JWT_SECRET", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]));

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const jwtSecret = process.env.SUPABASE_JWT_SECRET || "";
const nayaId = process.env.NAYA_EMPLOYEE_ID || DEFAULT_NAYA_ID;

function base64url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64url");
}

function signRunnerJwt(secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({
    iss: "supabase",
    ref: "wqdzqqshoifwyrltzgvx",
    role: "ai_employee_runner",
    iat: now,
    exp: now + 10 * 60,
  }));
  const data = `${header}.${body}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest();
  return `${data}.${base64url(signature)}`;
}

function brief(body) {
  if (body == null || body === "") return "(kosong)";
  const message = typeof body === "string"
    ? body
    : body.message || body.error || body.msg || body.hint || body.code || "";
  return String(message)
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "(tanpa pesan)";
}

function isJwtOrKeyRejected(status, body) {
  const text = brief(body).toLowerCase();
  if (/permission denied/.test(text)) return false;
  return status === 401 && /jwt|jws|bearer|malformed|signature|invalid token|invalid api key|no suitable key|unauthorized|pgrst301/.test(text);
}

function isPermissionDenied(status, body) {
  const text = brief(body).toLowerCase();
  const code = typeof body === "object" && body ? String(body.code || "") : "";
  return /permission denied/.test(text) || code === "42501" || status === 403;
}

async function callApi(token, apiKey, method, pathname, payload) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let body = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

function explainSigningStop(reason) {
  console.log(`BERHENTI: ${reason}`);
  console.log("Opsi:");
  console.log("1. Isi SUPABASE_JWT_SECRET dengan legacy JWT secret project (Dashboard → Project Settings → API → JWT Secret), lalu jalankan skrip ini lagi. Jangan tempel secret itu ke chat.");
  console.log("2. Kalau legacy secret sudah dimatikan dan yang berlaku hanya signing key asimetris, JWT role ai_employee_runner tidak bisa dibuat dengan secret bersama. Hidupkan lagi legacy JWT secret untuk uji ini, atau pakai jalur cadangan service role yang hanya memanggil rpc. Jalur cadangan tidak membuktikan SELECT employees ditolak.");
}

const results = [];
function report(name, ok, detail, label) {
  results.push({ name, ok, detail });
  const word = label ?? (ok ? "BERHASIL" : "GAGAL");
  console.log(`${word}  ${name}: ${detail}`);
}

if (!jwtSecret) {
  explainSigningStop("SUPABASE_JWT_SECRET tidak ada di environment. Tidak ada token yang dibuat dan tidak ada panggilan API.");
  process.exit(2);
}

const token = signRunnerJwt(jwtSecret);
let apiKey = token;
let authMode = "jwt-sebagai-apikey";

async function rpc(name, args) {
  let result = await callApi(token, apiKey, "POST", `/rest/v1/rpc/${name}`, args);
  if (authMode === "jwt-sebagai-apikey" && anonKey && isJwtOrKeyRejected(result.status, result.body) && /invalid api key/.test(brief(result.body).toLowerCase())) {
    apiKey = anonKey;
    authMode = "anon-sebagai-apikey";
    result = await callApi(token, apiKey, "POST", `/rest/v1/rpc/${name}`, args);
  }
  return result;
}

let runId = null;
try {
  const started = await rpc("ai_employee_run_start", {
    p_employee_id: nayaId,
    p_sop_code: "SOP2",
  });
  if (isJwtOrKeyRejected(started.status, started.body)) {
    explainSigningStop(`panggilan pertama ditolak gateway (${started.status}): ${brief(started.body)}`);
    process.exit(2);
  }
  runId = typeof started.body === "string" ? started.body : null;
  const startOk = started.status >= 200 && started.status < 300 && /^[0-9a-f-]{36}$/i.test(runId || "");
  report("a. ai_employee_run_start", startOk, startOk ? `run_id diterima, mode ${authMode}` : `${started.status} ${brief(started.body)}`);

  if (startOk) {
    const context = await rpc("ai_employee_context", {
      p_employee_id: nayaId,
      p_run_id: runId,
      p_scope: "pillars",
      p_params: {},
    });
    const rows = context.body && typeof context.body === "object" ? context.body.rows : null;
    const count = Array.isArray(rows) ? rows.length : 0;
    const contextOk = context.status >= 200 && context.status < 300 && count > 0;
    report(
      "b. ai_employee_context pillars",
      contextOk,
      contextOk ? `${count} baris` : `${context.status} ${brief(context.body)}`,
    );

    const finished = await rpc("ai_employee_run_finish", {
      p_employee_id: nayaId,
      p_run_id: runId,
      p_status: "succeeded",
      p_model_calls: 0,
      p_plan_count: 0,
      p_object_ids: null,
      p_note: "uji pintu runner",
    });
    const finishOk = finished.status >= 200 && finished.status < 300;
    report(
      "c. ai_employee_run_finish",
      finishOk,
      finishOk ? "succeeded, 0 panggilan, 0 plan" : `${finished.status} ${brief(finished.body)}`,
    );
    runId = finishOk ? null : runId;
  }

  const selected = await callApi(
    token,
    apiKey,
    "GET",
    "/rest/v1/employees?select=id&limit=1",
  );
  const selectRejected = isPermissionDenied(selected.status, selected.body) || (selected.status === 401 && !isJwtOrKeyRejected(selected.status, selected.body));
  report(
    "negatif SELECT employees",
    selectRejected,
    selectRejected ? `${selected.status} ${brief(selected.body)}` : `tidak ditolak (${selected.status} ${brief(selected.body)})`,
    selectRejected ? "DITOLAK" : "GAGAL",
  );

  const statusCall = await rpc("ai_employee_set_performance_status", {
    p_employee_id: nayaId,
    p_status: "on_track",
  });
  const statusRejected = isPermissionDenied(statusCall.status, statusCall.body)
    || (statusCall.status === 401 && !isJwtOrKeyRejected(statusCall.status, statusCall.body));
  report(
    "negatif ai_employee_set_performance_status",
    statusRejected,
    statusRejected ? `${statusCall.status} ${brief(statusCall.body)}` : `tidak ditolak (${statusCall.status} ${brief(statusCall.body)})`,
    statusRejected ? "DITOLAK" : "GAGAL",
  );
} finally {
  if (runId) {
    const closed = await rpc("ai_employee_run_finish", {
      p_employee_id: nayaId,
      p_run_id: runId,
      p_status: "succeeded",
      p_model_calls: 0,
      p_plan_count: 0,
      p_object_ids: null,
      p_note: "uji pintu runner",
    }).catch((error) => ({ status: 0, body: error instanceof Error ? error.message : "gagal menutup run" }));
    console.log(`tutup run yang masih terbuka: ${closed.status} ${brief(closed.body)}`);
  }
}

const failed = results.some((item) => !item.ok);
process.exit(failed ? 1 : 0);
