import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import {
  authorizeCaller,
  buildSop2Prompt,
  decodeJwtPayload,
  interpretReserve,
  jakartaToday,
  nextWeekDays,
  parsePlanDraft,
  publicModelFailure,
  resolvePostDate,
  scriptAiCall,
  secretMatches,
  signRunnerJwt,
  validatePlanDraft,
} from "../../supabase/functions/_shared/aiEmployee/planDraft.mjs";

const pillarId = "11111111-1111-4111-8111-111111111111";
const pillars = [{ id: pillarId, name: "Produk" }];

test("internal secret yang cocok lolos, yang salah ditolak", () => {
  assert.equal(secretMatches("rahasia", "rahasia"), true);
  assert.equal(secretMatches("rahasia", "lain"), false);
  assert.equal(secretMatches("", "rahasia"), false);
  assert.deepEqual(authorizeCaller({
    internalHeaderPresent: true,
    internalMatches: true,
    userId: null,
    roles: [],
  }), { ok: true, mode: "internal" });
  assert.equal(authorizeCaller({
    internalHeaderPresent: true,
    internalMatches: false,
    userId: "user-1",
    roles: ["owner"],
  }).status, 401);
});

test("user owner atau admin lolos, role lain dan tanpa login ditolak", () => {
  assert.equal(authorizeCaller({
    internalHeaderPresent: false,
    internalMatches: false,
    userId: "user-1",
    roles: ["Admin"],
  }).mode, "user");
  assert.equal(authorizeCaller({
    internalHeaderPresent: false,
    internalMatches: false,
    userId: "user-1",
    roles: ["employee"],
  }).status, 403);
  assert.equal(authorizeCaller({
    internalHeaderPresent: false,
    internalMatches: false,
    userId: null,
    roles: ["owner"],
  }).status, 401);
});

test("JWT runner membawa role ai_employee_runner dan tanda tangan yang cocok", async () => {
  const secret = "test-secret-bukan-secret-project";
  const token = await signRunnerJwt(secret, { now: 1_700_000_000, ref: "projectref" });
  const payload = decodeJwtPayload(token);
  assert.equal(payload.role, "ai_employee_runner");
  assert.equal(payload.ref, "projectref");
  assert.equal(payload.exp, payload.iat + 600);
  const [header, body, signature] = token.split(".");
  const key = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  assert.equal(signature, key);
  assert.equal(token.includes(secret), false);
});

test("prompt SOP2 memuat instruksi, pillar, dan katalog", () => {
  const prompt = buildSop2Prompt({
    instruction: "Buat plan peluncuran",
    today: "2026-11-02",
    allowedDates: ["2026-11-09"],
    postDate: "2026-11-09",
    pillars,
    catalog: [{ id: "svc-1", name: "Konsultasi" }],
    thinking: [{ id: "th-1", statement: "Fokus masalah onboarding" }],
    plans: [{ id: "plan-1", title: "Plan lama", post_date: "2026-11-02" }],
  });
  assert.match(prompt, /SOP2/);
  assert.match(prompt, /Buat plan peluncuran/);
  assert.match(prompt, /Hari ini \(Asia\/Jakarta\): 2026-11-02/);
  assert.match(prompt, /Rentang tanggal yang boleh: 2026-11-09 sampai 2026-11-09/);
  assert.match(prompt, new RegExp(pillarId));
  assert.match(prompt, /Konsultasi/);
});

test("tanggal posting ditentukan server, bukan model", () => {
  assert.equal(jakartaToday(new Date("2026-11-02T16:59:00.000Z")), "2026-11-02");
  assert.equal(jakartaToday(new Date("2026-11-02T17:30:00.000Z")), "2026-11-03");
  assert.deepEqual(nextWeekDays("2026-11-02"), [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ]);
  assert.deepEqual(nextWeekDays("2026-11-08"), [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ]);
  assert.equal(nextWeekDays("2026-12-31")[0], "2027-01-04");
  assert.equal(nextWeekDays("2026-12-31")[6], "2027-01-10");

  const today = "2026-11-02";
  assert.equal(resolvePostDate({
    today,
    requestedDate: "2026-11-20",
    modelDate: "2023-11-03",
    plans: [],
  }).postDate, "2026-11-20");
  assert.equal(resolvePostDate({
    today,
    requestedDate: today,
    modelDate: "2023-11-03",
    plans: [],
  }).postDate, today);
  assert.equal(resolvePostDate({
    today,
    requestedDate: "2023-11-03",
    modelDate: "2026-11-10",
    plans: [],
  }).ok, false);
  assert.equal(resolvePostDate({
    today,
    requestedDate: "2026-02-31",
    modelDate: "2026-11-10",
    plans: [],
  }).ok, false);
  assert.equal(resolvePostDate({
    today,
    requestedDate: "",
    modelDate: "2026-11-12",
    plans: [{ post_date: "2026-11-09" }],
  }).postDate, "2026-11-12");
  assert.equal(resolvePostDate({
    today,
    requestedDate: "",
    modelDate: "2023-11-03",
    plans: [
      { post_date: "2026-11-09" },
      { post_date: "2026-11-09T17:00:00.000Z" },
      { post_date: "2026-11-02" },
    ],
  }).postDate, "2026-11-11");
  const full = [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ].map((post_date) => ({ post_date }));
  assert.equal(resolvePostDate({
    today,
    requestedDate: "",
    modelDate: "bukan-tanggal",
    plans: full,
  }).postDate, "2026-11-09");

  const openPrompt = buildSop2Prompt({
    instruction: "Buat plan",
    today,
    allowedDates: nextWeekDays(today),
    pillars,
    catalog: [],
    thinking: [],
    plans: [],
  });
  assert.match(openPrompt, /Hari ini \(Asia\/Jakarta\): 2026-11-02/);
  assert.match(openPrompt, /Rentang tanggal yang boleh: 2026-11-09 sampai 2026-11-15/);
});

test("JSON model diterima hanya bila pillar ada di context", () => {
  const parsed = parsePlanDraft("```json\n{\"title\":\"Peluncuran\",\"post_date\":\"2026-11-09\",\"brief\":\"Masalah onboarding\",\"content_pillar_id\":\"" + pillarId + "\"}\n```");
  const accepted = validatePlanDraft(parsed, { pillars });
  assert.equal(accepted.ok, true);
  const wrongPillar = validatePlanDraft({
    ...parsed,
    content_pillar_id: "22222222-2222-4222-8222-222222222222",
  }, { pillars });
  assert.equal(wrongPillar.ok, false);
  assert.equal(resolvePostDate({
    today: "2026-11-02",
    requestedDate: "2026-11-10",
    modelDate: parsed.post_date,
    plans: [],
  }).postDate, "2026-11-10");
  assert.equal(parsePlanDraft("bukan json"), null);
});

test("kuota habis berhenti sebelum dianggap sukses", () => {
  assert.equal(interpretReserve(403, { message: "quota_exceeded" }).kind, "quota");
  assert.equal(interpretReserve(200, { allowed: false }).kind, "quota");
  assert.equal(interpretReserve(200, { allowed: true, used: 1 }).kind, "ok");
});

test("panggilan model memakai generate-script-ai yang sudah ada", () => {
  const call = scriptAiCall({
    url: "https://db.example",
    serviceRoleKey: "service-key",
    anonKey: "anon-key",
    internalSecret: "internal-secret",
    organizationId: "org-1",
    userId: "user-1",
    prompt: "SOP2",
  });
  assert.equal(call.url, "https://db.example/functions/v1/generate-script-ai");
  const body = JSON.parse(call.init.body);
  assert.equal(body.purpose, "thinking_json");
  assert.equal(body.temperature, 0);
  assert.equal(body.prompt, "SOP2");
  assert.equal(Object.hasOwn(body, "internal_secret"), false);
  assert.equal(call.init.headers.apikey, "service-key");
  assert.equal(call.init.headers.Authorization, "Bearer service-key");
  assert.equal(call.init.headers["x-synckerja-internal-secret"], "internal-secret");
});

test("pesan gagal model pendek dan tanpa token", () => {
  const failure = publicModelFailure(401, {
    message: "Invalid JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature",
  });
  assert.equal(failure.status, 401);
  assert.equal(failure.message.includes("eyJ"), false);
  assert.equal(failure.message.length <= 200, true);
});
