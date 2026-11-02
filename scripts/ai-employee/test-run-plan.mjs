import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import {
  authorizeCaller,
  buildChatPrompt,
  buildSop1Prompt,
  buildSop2Prompt,
  chooseBrandFocus,
  chooseSop1Pillar,
  executionVerdict,
  EXECUTION_CHECK_IDS,
  fourWeekBounds,
  greetingPeriod,
  greetingReply,
  isSimpleChatGreeting,
  politeAddress,
  sop1CloseStatus,
  zonedClock,
  decodeJwtPayload,
  interpretReserve,
  jakartaToday,
  nextWeekDays,
  nextWeeklyRun,
  openPlanDays,
  parseChatReply,
  pickUnusedIdea,
  chooseProduct,
  chooseProductFields,
  judgeJobDesk,
  withJobClaim,
  parseExecutionCheck,
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

test("obrolan mengembalikan reply dan tidak meminta plan", () => {
  const prompt = buildChatPrompt({
    name: "Naya",
    jobTitle: "Content Planner",
    sops: [{ code: "SOP2", title: "Tugas dadakan" }],
    message: "Hai, apa kabar?",
  });
  assert.match(prompt, /Sebut dirimu Naya/);
  assert.match(prompt, /Jangan membuat content plan/);
  assert.match(prompt, /Jangan menolak sapaan/);
  assert.match(prompt, /Hai, apa kabar\?/);
  const spoken = buildChatPrompt({
    name: "Naya",
    jobTitle: "Content Planner",
    sops: [],
    message: "gw bos lu",
    speaker: { name: "Octa Vialdi", role: "owner", address: "Pak Aldi", isReviewer: true },
    reviewerName: "Pak Aldi",
  });
  assert.match(spoken, /Pak Aldi/);
  assert.match(spoken, /Dia reviewer kamu/);
  assert.match(spoken, /pukul \d{2}:\d{2} \(Asia\/Jakarta\)/);
  assert.match(spoken, /Selamat (pagi|siang|sore|malam)/);
  assert.equal(isSimpleChatGreeting("nay", "Naya"), true);
  assert.equal(isSimpleChatGreeting("gw bos lu", "Naya"), false);
  assert.equal(politeAddress("Octa Vialdi", "owner"), "Pak Aldi");
  assert.match(greetingReply("Naya", "Pak Aldi", { hour: 17 }), /Selamat sore Pak Aldi, aku Naya/);
  assert.equal(parseChatReply("```json\n{\"reply\":\"Hai, aku Naya.\"}\n```"), "Hai, aku Naya.");
  assert.equal(parseChatReply("{\"title\":\"bukan obrolan\"}"), null);
});

test("salam mengikuti jam di zona waktu profil", () => {
  const samples = [
    ["2026-11-02T21:00:00.000Z", "2026-11-03", "04:00", "pagi"],
    ["2026-11-02T03:59:00.000Z", "2026-11-02", "10:59", "pagi"],
    ["2026-11-02T04:00:00.000Z", "2026-11-02", "11:00", "siang"],
    ["2026-11-02T07:59:00.000Z", "2026-11-02", "14:59", "siang"],
    ["2026-11-02T08:00:00.000Z", "2026-11-02", "15:00", "sore"],
    ["2026-11-02T10:50:00.000Z", "2026-11-02", "17:50", "sore"],
    ["2026-11-02T10:59:00.000Z", "2026-11-02", "17:59", "sore"],
    ["2026-11-02T11:00:00.000Z", "2026-11-02", "18:00", "malam"],
    ["2026-11-02T20:59:00.000Z", "2026-11-03", "03:59", "malam"],
  ];
  for (const [instant, date, time, period] of samples) {
    const clock = zonedClock("Asia/Jakarta", new Date(instant));
    assert.equal(clock.date, date, instant);
    assert.equal(clock.time, time, instant);
    assert.equal(greetingPeriod(clock.hour), period, instant);
    assert.match(greetingReply("Naya", "Pak Aldi", clock), new RegExp(`Selamat ${period} Pak Aldi`));
  }
  assert.equal(greetingPeriod(4), "pagi");
  assert.equal(greetingPeriod(10), "pagi");
  assert.equal(greetingPeriod(11), "siang");
  assert.equal(greetingPeriod(14), "siang");
  assert.equal(greetingPeriod(15), "sore");
  assert.equal(greetingPeriod(17), "sore");
  assert.equal(greetingPeriod(18), "malam");
  assert.equal(greetingPeriod(3), "malam");
  const fallback = zonedClock("Bukan/Zona", new Date("2026-11-02T10:50:00.000Z"));
  assert.equal(fallback.timeZone, "Asia/Jakarta");
  assert.equal(fallback.time, "17:50");
  const prompt = buildChatPrompt({
    name: "Naya",
    jobTitle: "Content Planner",
    sops: [],
    message: "hari ini mau posting apa?",
    clock: { timeZone: "Asia/Jakarta", date: "2026-11-02", time: "17:50", hour: 17 },
  });
  assert.match(prompt, /Sekarang 2026-11-02 pukul 17:50 \(Asia\/Jakarta\)/);
  assert.match(prompt, /Selamat sore/);
  assert.match(prompt, /"hari ini" adalah 2026-11-02/);
});

test("SOP1 mengisi hari kosong dan menahan pillar di atas 40 persen", () => {
  const fridayMorning = new Date("2026-11-06T07:59:00.000Z");
  const fridayStart = new Date("2026-11-06T08:00:00.000Z");
  const before = nextWeeklyRun({ weekday: 5, startLocal: "15:00", timeZone: "Asia/Jakarta", after: fridayMorning });
  const after = nextWeeklyRun({ weekday: 5, startLocal: "15:00", timeZone: "Asia/Jakarta", after: fridayStart });
  assert.deepEqual(before, { timeZone: "Asia/Jakarta", date: "2026-11-06", time: "15:00:00" });
  assert.deepEqual(after, { timeZone: "Asia/Jakarta", date: "2026-11-13", time: "15:00:00" });
  const fromMonday = nextWeeklyRun({
    weekday: 5,
    startLocal: "15:00:00",
    timeZone: "Not/AZone",
    after: new Date("2026-11-02T03:00:00.000Z"),
  });
  assert.equal(fromMonday.timeZone, "Asia/Jakarta");
  assert.equal(fromMonday.date, "2026-11-06");

  const windowDays = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  assert.deepEqual(fourWeekBounds(windowDays), { start: "2026-10-19", end: "2026-11-15" });
  const open = openPlanDays(windowDays, [
    { post_date: "2026-11-09" },
    { post_date: "2026-11-11" },
    { post_date: "2026-10-19" },
  ]);
  assert.deepEqual(open, ["2026-11-10", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.deepEqual(openPlanDays(windowDays, windowDays.map((post_date) => ({ post_date }))), []);

  const alfa = { id: "alfa", name: "Alfa" };
  const beta = { id: "beta", name: "Beta" };
  assert.equal(chooseSop1Pillar([beta, alfa], []).id, "alfa");
  assert.equal(chooseSop1Pillar([alfa, beta], [{ content_pillar_id: "alfa" }, { content_pillar_id: "alfa" }]).id, "beta");
  const crowded = [
    { content_pillar_id: "alfa" },
    { content_pillar_id: "alfa" },
    { content_pillar_id: "beta" },
    { content_pillar_id: "beta" },
    { content_pillar_id: "gamma" },
  ];
  assert.equal(chooseSop1Pillar([
    { id: "alfa", name: "Alfa" },
    { id: "beta", name: "Beta" },
    { id: "gamma", name: "Gamma" },
  ], crowded).id, "gamma");
  assert.equal(chooseSop1Pillar([{ id: "alfa", name: "Alfa" }], crowded), null);

  assert.equal(sop1CloseStatus({
    weekday: 5,
    dueLocal: "17:00:00",
    clock: { date: "2026-11-06", time: "17:50" },
  }), "late");
  assert.equal(sop1CloseStatus({
    weekday: 5,
    dueLocal: "17:00",
    clock: { date: "2026-11-06", time: "16:59" },
  }), "succeeded");
  assert.equal(sop1CloseStatus({
    weekday: 5,
    dueLocal: "17:00",
    clock: { date: "2026-11-02", time: "18:00" },
  }), "succeeded");

  const prompt = buildSop1Prompt({
    day: "2026-11-10",
    pillar: { id: "alfa", name: "Alfa" },
    steps: [{ step_no: 1, instruction: "Baca kalender" }],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
  });
  assert.match(prompt, /2026-11-10/);
  assert.match(prompt, /alfa/);
  assert.match(prompt, /Jangan menyetujui/);
  assert.deepEqual(parseExecutionCheck("{\"ok\":false}"), { ok: false });
  assert.equal(parseExecutionCheck("{\"title\":\"bukan cek\"}"), null);
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

test("brief, persona, dan fokus brand masuk ke prompt", () => {
  const brief = {
    service_ids: ["svc-a", "svc-b"],
    services: [{ id: "svc-a", name: "Sate Sultan" }, { id: "svc-b", name: "Kopi Sultan" }],
    audience: "keluarga",
    personas: [{ id: "persona-1", audience: "ibu muda" }],
    voice: "hangat",
    required_notes: "sebut sate",
    forbidden_notes: "jangan harga",
    split_rule: "bergiliran",
    pillar_ids: [],
  };
  const clock = { date: "2026-11-02", time: "18:00", hour: 18, timeZone: "Asia/Jakarta" };
  const chat = buildChatPrompt({ name: "Naya", message: "halo", brief, clock });
  assert.match(chat, /ibu muda/);
  assert.match(chat, /hangat/);
  const sop1 = buildSop1Prompt({
    day: "2026-11-09",
    pillar: { id: "pillar-1", name: "Produk" },
    steps: [],
    catalog: brief.services,
    thinking: [],
    feedback: [],
    plans: [{ post_date: "2026-11-09", author_name: "Bukan Naya", pillar_name: "Produk", service_name: "Sate Sultan" }],
    brief,
    performance: [{ kind: "ads", platform: "meta", connected_accounts: 1, spend: null }],
    service: { id: "svc-a", name: "Sate Sultan" },
  });
  assert.match(sop1, /svc-a/);
  assert.match(sop1, /jangan harga/);
  assert.match(sop1, /connected_accounts/);
  assert.match(sop1, /Bukan Naya/);
  const sop3 = buildSop2Prompt({
    instruction: "perbaiki plan yang ditolak",
    today: "2026-11-02",
    allowedDates: ["2026-11-09"],
    pillars: [],
    catalog: brief.services,
    thinking: [],
    plans: [],
    brief,
    revision: true,
  });
  assert.match(sop3, /SOP3/);
  assert.match(sop3, /ibu muda/);
  assert.equal(chooseBrandFocus({ brief, catalog: [...brief.services, { id: "svc-c", name: "Lain" }], dayIndex: 1 }).id, "svc-b");
  assert.equal(chooseBrandFocus({
    brief,
    catalog: [...brief.services, { id: "svc-c", name: "Lain" }],
    instruction: "buat untuk Lain",
    allowOverride: true,
  }).id, "svc-c");
  assert.equal(chooseBrandFocus({
    brief,
    catalog: [...brief.services, { id: "svc-c", name: "Lain" }],
    instruction: "buat untuk Lain",
    allowOverride: false,
  }).id, "svc-a");
  assert.deepEqual(openPlanDays(["2026-11-09", "2026-11-10"], [{ post_date: "2026-11-09", author_name: "Bukan Naya" }]), ["2026-11-10"]);
  assert.equal(pickUnusedIdea([{ idea_id: "used", used: true }, { idea_id: "open", used: false }]).idea_id, "open");
});

test("cek execution menolak accepted true tanpa sepuluh cek", () => {
  assert.equal(executionVerdict({ accepted: true }).ok, false);
  const checks = EXECUTION_CHECK_IDS.map((id) => ({ id, state: "pass" }));
  const passed = executionVerdict({
    statement: "Makan malam keluarga",
    checks,
    facts: { resolution: "RESOLVED", relationToParent: "VALID_EXECUTION", unresolvedReasons: [] },
    script: { title: "Makan malam" },
  });
  assert.equal(passed.ok, true);
  const missing = executionVerdict({
    statement: "Makan malam keluarga",
    checks: checks.slice(1),
    facts: { resolution: "RESOLVED", relationToParent: "VALID_EXECUTION", unresolvedReasons: [] },
    script: { title: "Makan malam" },
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.check_id, "hookHolds");
});

test("pesan gagal model pendek dan tanpa token", () => {
  const failure = publicModelFailure(401, {
    message: "Invalid JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature",
  });
  assert.equal(failure.status, 401);
  assert.equal(failure.message.includes("eyJ"), false);
  assert.equal(failure.message.length <= 200, true);
});

test("product knowledge yang tidak dikirim tidak masuk prompt dan baris terpakai dilewati", () => {
  const kept = "11111111-1111-4111-8111-111111111111";
  const open = "22222222-2222-4222-8222-222222222222";
  const product = [
    { id: kept, feature_name: "Sate sudah terpakai", unused: false },
    { id: open, feature_name: "Sate belum terpakai", unused: true },
  ];
  const prompt = buildChatPrompt({
    name: "Naya",
    message: "buat ide",
    product,
    clock: { date: "2026-11-02", time: "18:00", hour: 18, timeZone: "Asia/Jakarta" },
  });
  assert.match(prompt, /Sate belum terpakai/);
  assert.match(prompt, /tidak boleh mengubah Angle atau Idea/);
  assert.match(prompt, /sumber fakta dan insight/);
  assert.match(prompt, /Jangan mengarang fitur, komposisi, angka, atau klaim/);
  assert.equal(prompt.includes("Pakai what makes them stop sebagai hook"), false);
  assert.equal(prompt.includes("Fitur yang tidak dikirim"), false);
  const sop1 = buildSop1Prompt({
    day: "2026-11-09",
    pillar: { id: "pillar-1", name: "Produk" },
    steps: [],
    product,
  });
  assert.match(sop1, /product_knowledge_fields/);
  assert.match(sop1, /Prioritas 1/);
  const sop3 = buildSop2Prompt({
    instruction: "perbaiki",
    today: "2026-11-02",
    allowedDates: ["2026-11-09"],
    revision: true,
    product,
  });
  assert.match(sop3, /product_knowledge_fields/);
  assert.match(sop3, /Prioritas 3/);
  assert.equal(chooseProduct(product, kept), open);
  assert.equal(chooseProduct(product, open), open);
  assert.equal(chooseProduct([], open), null);
  const row = { feature_name: "Sate belum terpakai", false_belief: "mitos", impact: "  " };
  assert.deepEqual(chooseProductFields(["impact", "rahasia", "false_belief", "false_belief"], row), ["false_belief"]);
  assert.deepEqual(chooseProductFields(["feature_name"], null), []);
});

test("job desk menolak payroll dan menerima content plan", () => {
  const payroll = judgeJobDesk("hitung gaji karyawan");
  assert.equal(payroll.ok, false);
  if (!payroll.ok) assert.match(payroll.reason, /payroll/);
  assert.equal(judgeJobDesk("buat content plan untuk minggu depan").ok, true);
  assert.equal(judgeJobDesk("buat content plan tentang gaji").ok, true);
});

test("withJobClaim hanya menempelkan token klaim yang ada", () => {
  const token = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(withJobClaim({ title: "A" }, token), { title: "A", claim_token: token });
  assert.deepEqual(withJobClaim({ title: "A" }, ""), { title: "A" });
  assert.deepEqual(withJobClaim({ title: "A" }, null), { title: "A" });
});
