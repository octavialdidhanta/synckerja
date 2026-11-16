import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import {
  authorizeCaller,
  buildChatPrompt,
  buildSop1Prompt,
  usedTopicPhrases,
  buildSop2Prompt,
  catalogChoice,
  catalogPalette,
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
  contentPlanDates,
  dailySlotIndex,
  manualCatalogIndex,
  nextMonthDays,
  nextWeekDays,
  nextWeeklyRun,
  openPlanDays,
  parseChatReply,
  pickUnusedIdea,
  chooseProduct,
  chooseBriefProduct,
  chooseProductFields,
  chooseFocusedProductFields,
  judgeJobDesk,
  withJobClaim,
  parseExecutionCheck,
  appendCarouselDevelopmentPath,
  buildCarouselPathCheckPrompt,
  buildCarouselPathPrompt,
  carouselDevelopmentPath,
  parseCarouselPathCheck,
  parseCarouselPathReviews,
  rankCarouselPillars,
  chooseContentTurn,
  carouselNotesOk,
  rankPillarsForRotation,
  carouselReferenceOk,
  normalizeCarouselReference,
  parseCarouselDraft,
  diagnoseCarouselDraft,
  diagnoseCarouselDraftDetail,
  invalidRewriteNote,
  captionHashtags,
  brandLockupFromBrief,
  placeLockupHashtags,
  pickMenuIds,
  pickSystemHook,
  systemHookPromptLines,
  hookHasRawPlaceholders,
  copyClaimTokens,
  copyCollides,
  orderCopyFallbackPaths,
  selectCopyPriors,
  buildExecutionCheckPrompt,
  parsePlanDraft,
  referencePositions,
  publicModelFailure,
  resolvePostDate,
  scriptAiCall,
  secretMatches,
  signRunnerJwt,
  validatePlanDraft,
  rotateReference,
  briefWithReference,
  hookFromElement,
  headlineFromElement,
  headlineRepeats,
  openingStyleFor,
  usedOpenings,
} from "../../supabase/functions/_shared/aiEmployee/planDraft.mjs";

const pillarId = "11111111-1111-4111-8111-111111111111";
const pillars = [{ id: pillarId, name: "Produk" }];
const CAPTION_TAGS = "#synckerja #kontenBisnis #operasionalTim";
/** Body ≥200 chars after strip — passes captionDepthOk without relying on hashtags/lockup. */
const DEEP_CAPTION_BODY = [
  "Di ruang operasional yang kelihatan tenang, satu status hijau sering menutupi antrean kerja yang menumpuk diam-diam.",
  "Tim baru sadar setelah deadline bergeser, bukan saat sinyal awal muncul di chat harian.",
  "Coba cek dulu: apa yang diukur hari ini benar-benar menampilkan beban tersembunyi, atau hanya menenangkan dashboard?",
].join(" ");
const DEEP_CAPTION = `${DEEP_CAPTION_BODY}\n\n${CAPTION_TAGS}`;
const SATE_TAGS = "#sate #dagingMuda #kulinerJakarta";
const DEEP_SATE_CAPTION = `${DEEP_CAPTION_BODY}\n\n${SATE_TAGS}`;

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
  assert.deepEqual(contentPlanDates({
    cadence: "days",
    today: "2026-11-04",
    frequency: 3,
    plans: [{ post_date: "2026-11-04" }],
  }), ["2026-11-04"]);
  assert.deepEqual(contentPlanDates({
    cadence: "days",
    today: "2026-11-04",
    frequency: 1,
    plans: [{ post_date: "2026-11-04" }],
  }), ["2026-11-04"]);
  assert.equal(dailySlotIndex(["20:00", "09:00:00", "15:00"], "16:00"), 1);
  assert.equal(dailySlotIndex(["09:00", "15:00", "20:00"], "08:30"), 0);
  assert.equal(dailySlotIndex(["09:00", "15:00", "20:00"], "20:00"), 2);
  const focusBrief = { service_ids: ["alfa", "beta"] };
  const focusCatalog = [{ id: "alfa", name: "Alfa" }, { id: "beta", name: "Beta" }];
  assert.equal(chooseBrandFocus({
    brief: focusBrief,
    catalog: focusCatalog,
    dayIndex: dailySlotIndex(["09:00", "15:00", "20:00"], "16:00"),
  }).id, "beta");
  assert.equal(manualCatalogIndex([
    { post_date: "2026-11-11" },
    { post_date: "2026-11-11" },
    { post_date: "2026-11-10" },
  ], "2026-11-11"), 2);
  assert.equal(chooseBrandFocus({
    brief: focusBrief,
    catalog: focusCatalog,
    dayIndex: manualCatalogIndex([{ post_date: "2026-11-11" }], "2026-11-11"),
  }).id, "beta");
  assert.deepEqual(contentPlanDates({
    cadence: "weekly",
    today: "2026-11-04",
    frequency: 3,
    plans: [{ post_date: "2026-11-09" }],
  }), ["2026-11-10", "2026-11-11"]);
  assert.equal(contentPlanDates({
    cadence: "weekly",
    today: "2026-11-04",
    frequency: 8,
    plans: [],
  }).length, 7);
  assert.equal(nextMonthDays("2026-11-04")[0], "2026-12-01");
  assert.equal(nextMonthDays("2026-11-04").at(-1), "2026-12-31");
  assert.deepEqual(contentPlanDates({
    cadence: "monthly",
    today: "2026-11-30",
    frequency: 2,
    plans: [{ post_date: "2026-12-01" }],
  }), ["2026-12-02"]);

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

test("carousel menolak jumlah slide dan caption tanpa hashtag", () => {
  const slides = (count) => Array.from({ length: count }, (_, index) => ({
    timing: `Slide ${index + 1}`,
    visual: `Adegan ${index + 1} yang terlihat di slide.`,
    vo: `Copy slide ${index + 1} yang dibaca penonton.`,
    element: index === 0
      ? "Hook headline: Berhenti menebak. Visual hook: Kalender di depan wajah ibu."
      : `Kontras ekspresi pada slide ${index + 1}.`,
    tagging: "",
  }));
  const reason = "Konten ini dibuat karena penonton sering menebak solusi tanpa melihat masalah yang sebenarnya.";
  const raw = (count, caption, concept = reason) => JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption,
    concept,
    slides: slides(count),
    content_pillar_id: pillarId,
  });
  const accepted = parseCarouselDraft(raw(6, DEEP_CAPTION));
  assert.equal(accepted?.slides.length, 6);
  assert.equal(accepted?.concept, reason);
  assert.equal(accepted?.slides[0].timing, "Slide 1");
  assert.equal(parseCarouselDraft(raw(2, DEEP_CAPTION))?.slides.length, 2);
  assert.equal(parseCarouselDraft(raw(10, DEEP_CAPTION))?.slides.length, 10);
  assert.equal(parseCarouselDraft(raw(1, DEEP_CAPTION)), null);
  assert.equal(parseCarouselDraft(raw(11, DEEP_CAPTION)), null);
  // Soft-heal: missing/few/many hashtags are normalized instead of burning retries.
  assert.equal(diagnoseCarouselDraft(raw(5, DEEP_CAPTION_BODY)), "");
  assert.ok(parseCarouselDraft(raw(5, DEEP_CAPTION_BODY)));
  assert.equal(captionHashtags(parseCarouselDraft(raw(5, DEEP_CAPTION_BODY)).caption).length >= 3, true);
  assert.equal(diagnoseCarouselDraft(raw(5, `${DEEP_CAPTION_BODY}\n\n#synckerja`)), "");
  assert.ok(parseCarouselDraft(raw(5, `${DEEP_CAPTION_BODY}\n\n#synckerja`)));
  assert.equal(diagnoseCarouselDraft(raw(5, `${DEEP_CAPTION_BODY}\n\n#a #b #c #d #e #f`)), "");
  assert.equal(captionHashtags(parseCarouselDraft(raw(5, `${DEEP_CAPTION_BODY}\n\n#alpha #beta #gamma #delta #epsilon #zeta`)).caption).length, 5);
  assert.equal(diagnoseCarouselDraft(raw(1, DEEP_CAPTION)), "slides");
  assert.equal(diagnoseCarouselDraft("bukan-json"), "json");
  assert.equal(diagnoseCarouselDraft(""), "json");
  assert.match(invalidRewriteNote("hashtags"), /hashtag/i);
  assert.match(invalidRewriteNote("hook"), /Hook headline/i);
  assert.equal(diagnoseCarouselDraft(raw(6, DEEP_CAPTION)), "");

  // Caption reject detail: empty / too_thin / raw overshoot (same invalid:caption code, different reason).
  const emptyCaption = diagnoseCarouselDraftDetail(raw(5, ""));
  assert.equal(emptyCaption.code, "caption");
  assert.equal(emptyCaption.caption?.reason, "empty");
  assert.equal(emptyCaption.caption?.caption_len, 0);
  const thinBody = diagnoseCarouselDraftDetail(raw(5, "Pendek saja tanpa insight."));
  assert.equal(thinBody.code, "caption");
  assert.equal(thinBody.caption?.reason, "too_thin");
  assert.ok((thinBody.caption?.body_len ?? 200) < 200);
  const thinWithTags = diagnoseCarouselDraftDetail(raw(5, `Singkat saja ${CAPTION_TAGS}`));
  assert.equal(thinWithTags.code, "caption");
  assert.equal(thinWithTags.caption?.reason, "too_thin");
  // Soften trims to 800, so overshoot usually surfaces as raw_caption_len on another code — still loggable.
  const rawOvershoot = diagnoseCarouselDraftDetail(raw(5, "x".repeat(900)));
  assert.ok((rawOvershoot.caption?.raw_caption_len ?? 0) >= 900);
  assert.match(invalidRewriteNote("caption", { reason: "over_limit", caption_len: 950, body_len: 900, has_hash: false }), /melebihi 800/);
  assert.match(invalidRewriteNote("caption", { reason: "too_thin", caption_len: 40, body_len: 28, has_hash: false }), /terlalu tipis/);
  assert.match(invalidRewriteNote("caption", { reason: "too_thin", caption_len: 40, body_len: 28, has_hash: false }), /350-550/);
  assert.doesNotMatch(invalidRewriteNote("caption", { reason: "too_thin", caption_len: 40, body_len: 28, has_hash: false }), /artikel singkat/);
  assert.match(invalidRewriteNote("caption", { reason: "empty", caption_len: 0, body_len: 0, has_hash: false }), /kosong/);
  assert.match(invalidRewriteNote("caption", { reason: "empty", caption_len: 0, body_len: 0, has_hash: false }), /350-550/);
  const headlineOnly = slides(3);
  headlineOnly[0].element = "Headline: Berhenti menebak dulu. Arah gambar: panah ke kalender.";
  headlineOnly[0].vo = "";
  assert.equal(diagnoseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION_BODY,
    concept: reason,
    slides: headlineOnly,
    content_pillar_id: pillarId,
  })), "");
  const healed = parseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION_BODY,
    concept: reason,
    slides: headlineOnly,
  }));
  assert.ok(healed);
  assert.match(healed.slides[0].element, /Hook headline:/i);
  assert.match(healed.slides[0].element, /Visual hook:/i);
  assert.ok(healed.slides[0].vo);
  const shortConcept = parseCarouselDraft(raw(5, DEEP_CAPTION, "terlalu pendek"));
  assert.ok(shortConcept);
  assert.match(shortConcept.concept, /^terlalu pendek /);
  assert.ok(shortConcept.concept.length >= 40);
  assert.ok(shortConcept.concept.length <= 800);
  const missingConcept = parseCarouselDraft(raw(2, DEEP_CAPTION, ""));
  assert.ok(missingConcept);
  assert.ok(missingConcept.concept.length >= 40);
  const shifted = slides(5);
  shifted[1].timing = "Slide 3";
  assert.equal(parseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: "Konten ini dibuat karena penonton sering menebak solusi tanpa melihat masalah yang sebenarnya.",
    slides: shifted,
  })), null);
  assert.equal(diagnoseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: "Konten ini dibuat karena penonton sering menebak solusi tanpa melihat masalah yang sebenarnya.",
    slides: shifted,
  })), "timing");
  const missingHookSlides = slides(3);
  missingHookSlides[0].element = "Tanpa hook sama sekali di element slide pertama.";
  assert.equal(diagnoseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: missingHookSlides,
    content_pillar_id: pillarId,
  })), "");
  const healedHook = parseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: missingHookSlides,
  }));
  assert.ok(healedHook);
  assert.match(healedHook.slides[0].element, /Hook headline:/i);
  assert.match(healedHook.slides[0].element, /Visual hook:/i);
  const prompt = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: null,
    performance: [],
    service: null,
    idea: { id: "idea-1", idea_statement: "Ide apa pun" },
    product: [],
  });
  assert.match(prompt, /carousel/);
  assert.match(prompt, /4:5/);
  assert.match(prompt, /hashtag/i);
  assert.match(prompt, /3 sampai 5/);
  assert.match(prompt, /#bisnis/);
  assert.match(prompt, /alasan konten ini dibuat/);
  assert.match(prompt, /Hook headline/);
  assert.match(prompt, /teks pendukung di slide \(bukan voiceover audio\)/);
  const bare = slides(2);
  bare[0].vo = "";
  assert.equal(diagnoseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: bare,
    content_pillar_id: pillarId,
  })), "");
  const filledVo = parseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: bare,
  }));
  assert.ok(filledVo);
  assert.ok(filledVo.slides[0].vo);
  const shortVo = slides(2);
  shortVo[0].vo = "Coba aja";
  shortVo[1].vo = "Gini";
  assert.equal(diagnoseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: shortVo,
    content_pillar_id: pillarId,
  })), "");
  assert.ok(parseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: shortVo,
  })));
  const emptyVisual = slides(2);
  emptyVisual[0].visual = "";
  assert.equal(diagnoseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: emptyVisual,
  })), "visual");
  const noHook = slides(2);
  noHook[0].element = "Hanya ikon panah tanpa hook.";
  const healedNoHook = parseCarouselDraft(JSON.stringify({
    title: "Carousel uji",
    post_date: "2026-11-10",
    caption: DEEP_CAPTION,
    concept: reason,
    slides: noHook,
  }));
  assert.ok(healedNoHook);
  assert.match(healedNoHook.slides[0].element, /Hook headline:/i);
  assert.match(healedNoHook.slides[0].element, /Visual hook:/i);
  assert.doesNotMatch(prompt, /Ini pengulangan/);

  const fresh = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: { service_ids: ["svc"], services: [], audience: "", personas: [], voice: "hangat", required_notes: "", forbidden_notes: "" },
    performance: [],
    service: null,
    idea: { idea_id: "idea-1", idea_statement: "Memprediksi solusi diri" },
    product: [],
    path: {
      development: "Biarkan anak mencoba memprediksi solusi",
      prompt_voice: "hangat",
      is_repeat: false,
    },
  });
  assert.match(fresh, /Biarkan anak mencoba memprediksi solusi/);
  assert.match(fresh, /Gaya bahasa jalur ini: hangat/);
  assert.doesNotMatch(fresh, /lugas/);
  assert.doesNotMatch(fresh, /Ini pengulangan/);

  const repeat = buildSop1Prompt({
    day: "2026-11-17",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: { service_ids: ["svc"], services: [], audience: "", personas: [], voice: "hangat", required_notes: "", forbidden_notes: "" },
    performance: [],
    service: null,
    idea: { idea_id: "idea-1", idea_statement: "Memprediksi solusi diri" },
    product: [],
    path: {
      development: "Biarkan anak mencoba memprediksi solusi",
      prompt_voice: "lugas",
      is_repeat: true,
      previous_title: "Judul lama",
      previous_caption: "Caption lama #lama",
    },
  });
  assert.match(repeat, /Gaya bahasa jalur ini: lugas/);
  assert.match(repeat, /Ini pengulangan/);
  assert.match(repeat, /Judul lama/);
  assert.match(repeat, /Caption lama #lama/);
  assert.match(repeat, /Jangan menyalin judul atau caption/);
});

test("katalog brief paling banyak satu", () => {
  assert.deepEqual(catalogChoice(null), { status: "missing" });
  assert.deepEqual(catalogChoice({ service_ids: [] }), { status: "missing" });
  assert.deepEqual(catalogChoice({ service_ids: ["svc-a"] }), { status: "one", id: "svc-a" });
  assert.deepEqual(catalogChoice({ service_ids: ["svc-a", "svc-b"] }), { status: "many" });
  assert.equal(chooseBrandFocus({
    brief: { service_ids: ["svc-a"] },
    catalog: [{ id: "svc-a", name: "Satu" }, { id: "svc-b", name: "Dua" }],
    dayIndex: 4,
  }).id, "svc-a");
});

test("carousel memakai satu referensi yang sama di setiap slide", () => {
  const base = (count) => Array.from({ length: count }, (_, index) => ({
    timing: `Slide ${index + 1}`,
    visual: `Adegan ${index + 1} yang terlihat di slide.`,
    vo: `Copy slide ${index + 1} yang dibaca penonton.`,
    element: index === 0
      ? "Hook headline: Berhenti menebak. Visual hook: Kalender di depan wajah ibu."
      : `Kontras ekspresi pada slide ${index + 1}.`,
    tagging: "",
  }));
  const cited = (label) => base(2).map((slide) => ({ ...slide, element: `${slide.element} ${label}` }));
  assert.equal(carouselReferenceOk(base(2), []), true);
  assert.equal(referencePositions({ references: [] }).length, 0);
  assert.equal(carouselReferenceOk(cited("Referensi 2"), [2]), true);
  assert.equal(carouselReferenceOk(cited("Referensi 1"), [2]), false);
  const mixed = cited("Referensi 2");
  mixed[1] = { ...mixed[1], element: mixed[1].element.replace("Referensi 2", "Referensi 1") };
  assert.equal(carouselReferenceOk(mixed, [1, 2]), true);
  const doubled = cited("Referensi 2 dan Referensi 1");
  assert.equal(carouselReferenceOk(doubled, [1, 2]), false);
  const prompt = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: {
      service_ids: ["svc"],
      services: [],
      audience: "",
      personas: [],
      voice: "",
      required_notes: "",
      forbidden_notes: "",
      references: [
        { position: 2, storage_path: "org/employee/2.png" },
        { position: 5, storage_path: "org/employee/5.png" },
      ],
    },
    performance: [],
    service: null,
    idea: { id: "idea-1", idea_statement: "Ide apa pun" },
    product: [],
  });
  assert.match(prompt, /Semua slot ini boleh dipakai/);
  assert.match(prompt, /Jangan menulis slot pertama di setiap slide/);
  assert.match(prompt, /Referensi 2/);
  assert.match(prompt, /Referensi 5/);
  assert.doesNotMatch(prompt, /org\/employee\/2\.png/);
  const single = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: {
      service_ids: ["svc"],
      services: [],
      references: [{ position: 4 }],
    },
    performance: [],
    service: null,
    idea: null,
    product: [],
  });
  assert.match(single, /hanya slot 4/);
  assert.match(single, /Referensi 4/);
  const opening = "Hook headline: Berhenti menebak. Visual hook: Kalender di depan wajah ibu.";
  const follow = "Kontras ekspresi pada slide kedua.";
  const picked = normalizeCarouselReference([
    { element: `${opening} Referensi 5` },
    { element: follow },
  ], [2, 5]);
  assert.equal(carouselReferenceOk(picked, [2, 5]), true);
  assert.match(picked[0].element, /Hook headline:/);
  assert.match(picked[0].element, /Visual hook:/);
  assert.match(picked[1].element, /Referensi 5$/);
  const mixedChoice = normalizeCarouselReference([
    { element: `${opening} Referensi 2` },
    { element: `${follow} Referensi 5` },
  ], [2, 5]);
  assert.match(mixedChoice[0].element, /Referensi 2$/);
  assert.match(mixedChoice[1].element, /Referensi 5$/);
  const blank = normalizeCarouselReference([
    { element: opening },
    { element: follow },
  ], [2, 5]);
  assert.match(blank[0].element, /Referensi 2$/);
  assert.match(blank[1].element, /Referensi 2$/);
  const onlyFourth = normalizeCarouselReference([
    { element: opening },
    { element: `${follow} Referensi 1` },
  ], [4]);
  assert.match(onlyFourth[0].element, /Referensi 4$/);
  assert.match(onlyFourth[1].element, /Referensi 4$/);
  assert.doesNotMatch(onlyFourth[1].element, /Referensi 1/);
  const untouched = normalizeCarouselReference([
    { element: opening },
    { element: follow },
  ], []);
  assert.equal(untouched[0].element, opening);
  const long = normalizeCarouselReference([
    { element: `Hook headline: ${"a".repeat(220)} Visual hook: wajah ibu di depan kalender. ${"b".repeat(400)}` },
    { element: follow },
  ], [1, 3]);
  assert.match(long[0].element, /hook headline\s*:/i);
  assert.match(long[0].element, /visual hook\s*:/i);
  assert.match(long[0].element, /Referensi 1$/);
  assert.ok(long[0].element.length <= 500);
  const plain = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: null,
    performance: [],
    service: null,
    idea: null,
    product: [],
  });
  assert.doesNotMatch(plain, /Referensi visual/);
});

test("palet katalog masuk prompt dan logo tidak ikut", () => {
  const prompt = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: {
      service_ids: ["svc"],
      palette: { primary: "#112233", secondary: "#445566", accent: "#778899" },
      references: [{ position: 1 }],
    },
    performance: [],
    service: null,
    idea: null,
    product: [],
  });
  assert.match(prompt, /primer #112233/);
  assert.match(prompt, /sekunder #445566/);
  assert.match(prompt, /aksen #778899/);
  assert.match(prompt, /bukan sumber warna/);
  assert.match(prompt, /Jangan menulis kode warna ke dalam slide/);
  assert.match(prompt, /referensi layout dan font/);
  assert.match(prompt, /Font slide harus sama dengan font pada referensi yang dipilih/);
  assert.doesNotMatch(prompt, /logo/i);
  assert.equal(catalogPalette({ palette: { primary: "112233", secondary: "#445566", accent: "#778899" } }), null);
  assert.deepEqual(catalogPalette({ palette: { primary: "#AABBCC", secondary: "#112233", accent: "#445566" } }), {
    primary: "#aabbcc",
    secondary: "#112233",
    accent: "#445566",
  });
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
  assert.equal(pickUnusedIdea([{ idea_id: "open", used: false, skip: true }, { idea_id: "next", used: false }]).idea_id, "next");
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
  // An absent check is not a failed hook.
  assert.equal(missing.check_id, "checks_incomplete");
  const failedSlang = executionVerdict({
    statement: "Makan malam keluarga",
    checks: checks.map((item) => (item.id === "usesSlang" ? { id: "usesSlang", state: "fail" } : item)),
    facts: { resolution: "UNRESOLVED", relationToParent: "VALID_EXECUTION", unresolvedReasons: ["usesSlang: vo slide 2 pakai Anda", "unresolved"] },
    script: { title: "Makan malam" },
  });
  assert.equal(failedSlang.ok, false);
  assert.equal(failedSlang.check_id, "usesSlang");
  assert.deepEqual(failedSlang.reasons, ["usesSlang: vo slide 2 pakai Anda"]);
  const shaped = executionVerdict({
    statement: "Makan malam keluarga",
    checks: Object.fromEntries(EXECUTION_CHECK_IDS.map((id) => [id, "Pass"])),
    script: { title: "Makan malam" },
  });
  assert.equal(shaped.ok, true);
  assert.equal(shaped.facts.resolution, "RESOLVED");
  assert.equal(shaped.checks.find((item) => item.id === "hookHolds").state, "pass");
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
  assert.equal(chooseBriefProduct(product, kept), kept);
  assert.equal(chooseBriefProduct(product, "bukan-id"), open);
  assert.equal(chooseBriefProduct([], open), null);
  const row = { feature_name: "Sate belum terpakai", false_belief: "mitos", impact: "  " };
  assert.deepEqual(chooseProductFields(["impact", "rahasia", "false_belief", "false_belief"], row), ["false_belief"]);
  assert.deepEqual(chooseProductFields(["feature_name"], null), []);
  assert.deepEqual(
    chooseFocusedProductFields(["false_belief", "feature_name", "solusi", "competitive_advantage"], {
      feature_name: "Realtime",
      solusi: "Foto di hari H",
      competitive_advantage: "Selesai 24 jam",
      false_belief: "mitos",
    }),
    ["feature_name", "solusi", "competitive_advantage"],
  );
});

test("angle terkunci hanya mengirim empat kolom fakta", () => {
  const productRow = {
    id: "33333333-3333-4333-8333-333333333333",
    feature_name: "Realtime",
    feature_description: "Cinematic Wedding Highlight",
    solusi: "Foto di hari H",
    competitive_advantage: "Selesai 24 jam",
    false_belief: "mitos tersembunyi",
    problems_solved: "stres editing",
  };
  const brief = {
    service_ids: ["svc"],
    services: [{ id: "svc", name: "Vialdi Wedding" }],
    audience: "pembaca uji audiens khusus",
    personas: [{ id: "persona-1", audience: "wanita karier uji" }],
    voice: "hangat",
    required_notes: "",
    forbidden_notes: "",
    angle_ids: ["angle-1"],
  };
  const locked = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief,
    performance: [],
    service: null,
    idea: { idea_id: "idea-1", idea_statement: "Memprediksi solusi diri" },
    product: [productRow],
    path: { development: "Biarkan anak mencoba", prompt_voice: "hangat", is_repeat: false },
  });
  assert.match(locked, /Cinematic Wedding Highlight/);
  assert.match(locked, /Foto di hari H/);
  assert.match(locked, /Selesai 24 jam/);
  assert.match(locked, /feature_description/);
  assert.equal(locked.includes("false_belief"), false);
  assert.equal(locked.includes("pembaca uji audiens khusus"), false);
  assert.equal(locked.includes("wanita karier uji"), false);
  assert.equal(locked.includes("stres editing"), false);

  const open = buildSop1Prompt({
    day: "2026-11-10",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: { ...brief, angle_ids: [] },
    performance: [],
    service: null,
    idea: { idea_id: "idea-1", idea_statement: "Memprediksi solusi diri" },
    product: [productRow],
  });
  assert.match(open, /false_belief/);
  assert.match(open, /pembaca uji audiens khusus/);

  const adHoc = buildSop2Prompt({
    instruction: "buat satu plan",
    today: "2026-11-05",
    allowedDates: ["2026-11-10"],
    brief,
    product: [productRow],
  });
  assert.match(adHoc, /Cinematic Wedding Highlight/);
  assert.match(adHoc, /Selesai 24 jam/);
  assert.equal(adHoc.includes("false_belief"), false);
  assert.equal(adHoc.includes("pembaca uji audiens khusus"), false);

  const adHocOpen = buildSop2Prompt({
    instruction: "buat satu plan",
    today: "2026-11-05",
    allowedDates: ["2026-11-10"],
    brief: { ...brief, angle_ids: [] },
    product: [productRow],
  });
  assert.match(adHocOpen, /Prioritas 3/);
  assert.match(adHocOpen, /mitos tersembunyi/);
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

test("jalur carousel hanya menerima pilar yang ada dan lolos pemeriksaan", () => {
  const pillars = [
    { id: "11111111-1111-4111-8111-111111111111", name: "Mitos", description: "kepercayaan yang keliru tentang daging" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Resep", description: "cara memasak" },
  ];
  const context = "Penonton percaya daging kambing selalu berbau prengus.";
  const ranked = rankCarouselPillars(pillars, context, 1);
  assert.equal(ranked[0].name, "Mitos");
  const prompt = buildCarouselPathPrompt({ context, pillars: ranked });
  assert.match(prompt, /Do not invent a pillar/);
  assert.match(prompt, /already selected/);
  assert.match(prompt, /daging kambing selalu berbau prengus/);
  assert.match(prompt, /- Mitos:/);
  const reviews = parseCarouselPathReviews({
    reviews: [
      { pillar: "Pilar baru", development: "Ide lain.", reason: "Karena baru." },
      { pillar: "Mitos", development: "Mitos", reason: "Hanya nama pilar." },
      { pillar: "Mitos", development: "Kepercayaan bau prengus diuji dari satu potong daging.", reason: "Pilar ini menahan kepercayaan yang keliru." },
    ],
  }, ranked);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].contentPillarId, pillars[0].id);
  assert.equal(parseCarouselPathCheck('{"pass":true,"reason":""}'), null);
  assert.deepEqual(parseCarouselPathCheck('{"pass":false,"reason":"Development mengganti ide."}'), {
    pass: false,
    reason: "Development mengganti ide.",
  });
  const check = buildCarouselPathCheckPrompt({
    context,
    pillar: ranked[0],
    development: reviews[0].development,
    claim: reviews[0].reason,
  });
  assert.match(check, /PASS only when the development keeps the conceptual idea/);
  const saved = carouselDevelopmentPath({
    id: reviews[0].contentPillarId,
    name: reviews[0].pillarName,
    development: reviews[0].development,
    reason: "Pilar mitos menahan kepercayaan bau prengus tanpa mengganti ide.",
    savedAt: "2026-11-12T05:00:00.000Z",
  });
  assert.equal(saved.format, "carousel");
  assert.equal(saved.status, "RECOMMENDED");
  assert.equal(saved.reviews[0].development, reviews[0].development);
  const video = { contentPillarId: pillars[1].id, format: "video", status: "RECOMMENDED", reviews: [] };
  const next = appendCarouselDevelopmentPath([video, { contentPillarId: pillars[0].id, format: "carousel", reviews: [] }], saved);
  assert.equal(next.length, 2);
  assert.equal(next[0].format, "video");
  assert.equal(next[1].format, "carousel");
  assert.equal(next[1].reviews[0].status, "RECOMMENDED");
});

test("pilar digilir dari yang paling sedikit dipakai, bukan dari idea yang habis", () => {
  const pillars = [
    { id: "11111111-1111-4111-8111-111111111111", name: "B-Roll Storytelling" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Behind The Scene" },
    { id: "33333333-3333-4333-8333-333333333333", name: "Did You Know?" },
  ];
  const ranked = rankPillarsForRotation(pillars, [
    { id: pillars[0].id, count: 4, lastUsed: "2026-11-12T04:00:00.000Z" },
    { id: pillars[2].id, count: 0, lastUsed: "" },
  ]);
  assert.deepEqual(ranked.map((pillar) => pillar.name), ["Behind The Scene", "Did You Know?", "B-Roll Storytelling"]);
  const source = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  assert.equal(source.includes("usedIdeas"), false);
  assert.match(source, /rankPillarsForRotation/);
  assert.match(source, /chooseContentTurn/);
});

test("sop1 fokus gagal cepat bila antrean path kosong, tanpa invent jalur", () => {
  const source = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  const prepare = source.indexOf("const prepareCarouselPath");
  const blocked = source.indexOf('"ideas_blocked"', prepare);
  assert.ok(prepare > 0);
  assert.ok(blocked > prepare);
  assert.equal(source.includes('closeSop1("succeeded", "no_idea"'), false);
  assert.match(source, /usableQueued\.length === 0\) return \{ kind: "unconfirmed" \}/);
  assert.match(source, /queuedIdeaIds/);
  assert.match(source, /pathIdeas/);
  assert.doesNotMatch(source, /buildCarouselPathPrompt/);
  assert.doesNotMatch(source, /appendCarouselDevelopmentPath/);
  assert.match(source, /chooseContentTurn/);
});

test("angle terisi melewati angle plan terakhir", () => {
  const turn = chooseContentTurn({
    angles: [
      { id: "angle-a", lastUsed: "2026-11-12" },
      { id: "angle-b", lastUsed: "2026-11-01" },
    ],
    ideas: [
      { id: "idea-a", angleId: "angle-a", planCount: 1, lastUsed: "2026-11-12" },
      { id: "idea-b", angleId: "angle-b", planCount: 2, lastUsed: "2026-11-01" },
    ],
    pillars: [
      { id: "pillar-1", name: "Mitos", count: 0, lastUsed: "" },
      { id: "pillar-2", name: "B-Roll", count: 3, lastUsed: "2026-11-10" },
    ],
    takenPairs: [],
    previous: { angleId: "angle-a", ideaId: "idea-a", pillarId: "pillar-2" },
  });
  assert.equal(turn.angleId, "angle-b");
  assert.equal(turn.ideaId, "idea-b");
  assert.equal(turn.pillarId, "pillar-1");
});

test("semua idea sudah punya plan, yang jumlahnya paling sedikit yang terpilih", () => {
  const turn = chooseContentTurn({
    angles: [],
    ideas: [
      { id: "idea-a", angleId: "angle-a", planCount: 3, lastUsed: "2026-11-12" },
      { id: "idea-b", angleId: "angle-b", planCount: 1, lastUsed: "2026-11-11" },
      { id: "idea-c", angleId: "angle-c", planCount: 2, lastUsed: "2026-11-01" },
    ],
    pillars: [{ id: "pillar-1", name: "Mitos", count: 1, lastUsed: "2026-11-11" }],
    takenPairs: ["idea-a:pillar-1", "idea-b:pillar-1", "idea-c:pillar-1"],
    previous: { angleId: "angle-a", ideaId: "idea-a", pillarId: "pillar-1" },
  });
  assert.equal(turn, null);
  const open = chooseContentTurn({
    angles: [],
    ideas: [
      { id: "idea-a", angleId: "angle-a", planCount: 3, lastUsed: "2026-11-12" },
      { id: "idea-b", angleId: "angle-b", planCount: 1, lastUsed: "2026-11-11" },
      { id: "idea-c", angleId: "angle-c", planCount: 2, lastUsed: "2026-11-01" },
    ],
    pillars: [
      { id: "pillar-1", name: "Mitos", count: 4, lastUsed: "2026-11-12" },
      { id: "pillar-2", name: "Cerita", count: 0, lastUsed: "" },
    ],
    takenPairs: ["idea-b:pillar-1"],
    previous: { angleId: "angle-b", ideaId: "idea-b", pillarId: "pillar-1" },
  });
  assert.equal(open.ideaId, "idea-b");
  assert.equal(open.pillarId, "pillar-2");
});

test("catatan wajib memakai faktanya dan catatan terlarang tetap ditolak", () => {
  const phone = "081234567890";
  const required = `Input nomor telepon yang bisa di hubungi : ${phone}`;
  const slides = (lastVo) => ([
    {
      timing: "Slide 1",
      visual: "Daging kambing di atas panggangan.",
      vo: "Daging muda lebih empuk daripada daging tua.",
      element: "Hook headline: Empuk. Visual hook: Irisan daging.",
      tagging: "",
    },
    {
      timing: "Slide 2",
      visual: "Piring sate di meja.",
      vo: lastVo,
      element: "Ajakan datang pada jam buka.",
      tagging: "",
    },
  ]);
  const body = (caption, lastVo, title = "Daging muda") => JSON.stringify({
    title,
    post_date: "2026-11-12",
    caption,
    concept: "Konten ini dibuat karena penonton masih mengira daging tua selalu lebih enak untuk sate.",
    slides: slides(lastVo),
    content_pillar_id: pillarId,
  });
  const notes = { required, forbidden: "harga promo" };
  const saved = parseCarouselDraft(body(DEEP_SATE_CAPTION, "Simpan caranya di rumah."), notes);
  assert.equal(saved.caption.includes(phone), true);
  assert.equal(saved.caption.includes("#sate"), true);
  assert.equal(captionHashtags(saved.caption).length >= 3, true);
  assert.equal(saved.caption.includes("Input nomor telepon"), false);
  assert.equal(saved.slides[1].vo.includes(phone), true);
  assert.equal(saved.slides[1].vo.includes("Input nomor telepon"), false);
  assert.equal(carouselNotesOk(saved, notes), true);
  const already = parseCarouselDraft(body(`${DEEP_CAPTION_BODY} ${phone}\n\n${SATE_TAGS}`, `Simpan caranya ${phone}.`), notes);
  assert.equal(already.caption.split(phone).length - 1, 1);
  const soft = parseCarouselDraft(body(DEEP_SATE_CAPTION, "Simpan caranya di rumah."), { required: "Hubungi jam buka.", forbidden: "" });
  assert.equal(soft.caption.includes("Hubungi jam buka"), false);
  assert.equal(parseCarouselDraft(body(`${DEEP_CAPTION_BODY} ${phone}\n\n${SATE_TAGS}`, `Simpan caranya ${phone}.`, "Tanpa harga promo"), notes), null);
  const prompt = buildSop1Prompt({
    day: "2026-11-12",
    pillar: { id: pillarId, name: "Mitos" },
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: { service_ids: ["svc-a"], services: [], required_notes: required, forbidden_notes: "harga promo" },
    performance: [],
    service: { id: "svc-a", name: "Sate" },
  });
  assert.match(prompt, /Jangan salin kalimat instruksinya/);
  assert.match(prompt, new RegExp(phone));
  assert.doesNotMatch(prompt, /Salin teks ini apa adanya/);
  assert.match(prompt, /harga promo/);
  assert.match(prompt, /foto manusia sungguhan/);
});

test("caption menyisipkan website dan kontak lockup tanpa memaksa ke last vo", () => {
  const website = "https://synckerja.com/";
  const contact = "081118891308";
  const phone = "081234567890";
  const slides = (lastVo) => ([
    {
      timing: "Slide 1",
      visual: "Daging kambing di atas panggangan.",
      vo: "Daging muda lebih empuk daripada daging tua.",
      element: "Hook headline: Empuk. Visual hook: Irisan daging.",
      tagging: "",
    },
    {
      timing: "Slide 2",
      visual: "Piring sate di meja.",
      vo: lastVo,
      element: "Ajakan datang pada jam buka.",
      tagging: "",
    },
  ]);
  const body = (caption, lastVo) => JSON.stringify({
    title: "Daging muda",
    post_date: "2026-11-12",
    caption,
    concept: "Konten ini dibuat karena penonton masih mengira daging tua selalu lebih enak untuk sate.",
    slides: slides(lastVo),
    content_pillar_id: pillarId,
  });
  const lockup = { websiteUrl: website, defaultContact: contact };
  const saved = parseCarouselDraft(body(DEEP_SATE_CAPTION, "Simpan caranya di rumah."), null, lockup);
  assert.equal(saved.caption.includes(website), true);
  assert.equal(saved.caption.includes(contact), true);
  assert.equal(saved.caption.includes("#sate"), true);
  assert.equal(captionHashtags(saved.caption).length, 3);
  assert.equal(saved.slides[1].vo.includes(website), false);
  assert.equal(saved.slides[1].vo.includes(contact), false);
  assert.equal(carouselNotesOk(saved, null, lockup), true);
  const already = parseCarouselDraft(
    body(`${DEEP_CAPTION_BODY} ${website} ${contact}\n\n${SATE_TAGS}`, "Simpan caranya di rumah."),
    null,
    lockup,
  );
  assert.equal(already.caption.split(website).length - 1, 1);
  assert.equal(already.caption.split(contact).length - 1, 1);
  const withNotes = parseCarouselDraft(
    body(DEEP_SATE_CAPTION, "Simpan caranya di rumah."),
    { required: `Input nomor: ${phone}`, forbidden: "" },
    lockup,
  );
  assert.equal(withNotes.caption.includes(website), true);
  assert.equal(withNotes.caption.includes(contact), true);
  assert.equal(withNotes.caption.includes(phone), true);
  assert.equal(withNotes.slides[1].vo.includes(phone), true);
  assert.equal(withNotes.slides[1].vo.includes(website), false);
  assert.equal(carouselNotesOk({ ...withNotes, caption: DEEP_SATE_CAPTION }, { required: "", forbidden: "" }, lockup), false);
  const prompt = buildSop1Prompt({
    day: "2026-11-12",
    pillar: { id: pillarId, name: "Mitos", funnel: "awareness" },
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: {
      service_ids: ["svc-a"],
      services: [],
      company_logo_id: "logo-1",
      company_logos: [{ id: "logo-1", logo_path: "a.png", website_url: website, default_contact: contact }],
    },
    performance: [],
    service: { id: "svc-a", name: "Synckerja" },
    idea: {
      idea_statement: "Orang menyamakan sibuk dengan produktif.",
      territory_statement: "Tim kecil yang selalu online.",
      angle_statement: "Online terus justru menyembunyikan kerja yang tidak selesai.",
    },
  });
  assert.match(prompt, /Soft sell/);
  assert.match(prompt, /Batas total 800 karakter/);
  assert.match(prompt, /3 sampai 5/);
  assert.match(prompt, /1 niche/);
  assert.match(prompt, /#bisnis/);
  assert.match(prompt, /penonton perlu menyadari/);
  assert.match(prompt, /Struktur komunikasi caption/);
  assert.match(prompt, /Blind spot/);
  assert.match(prompt, /Discovery soft/);
  assert.match(prompt, /350 sampai 550/);
  assert.match(prompt, /artikel di feed yang layak dibaca lama/);
  assert.match(prompt, /Pisahkan paragraf dengan enter/);
  assert.match(prompt, /~100 karakter/);
  assert.match(prompt, /territory "/);
  assert.match(prompt, /angle "/);
  assert.match(prompt, /akan dilampirkan sistem di akhir caption|dilampirkan sistem/);
  assert.doesNotMatch(prompt, /caption wajib, singkat/);
  assert.doesNotMatch(prompt, /artikel singkat/);
  assert.doesNotMatch(prompt, /panjang blok bebas/);
  assert.doesNotMatch(prompt, /Batas total 400 karakter/);
  assert.doesNotMatch(prompt, /sebelum kemudian stuck kemudian solusi/);
  assert.doesNotMatch(prompt, /struktur wajib sebelum/);
  assert.doesNotMatch(prompt, /tiga sampai lima kalimat/);

  const autoTags = "#OtomatisasiProses #EfisiensiKerja #OperasionalTim";
  const rich = parseCarouselDraft(body(
    `Kadang otomatisasi malah bikin kerjaan lebih susah dilacak.\n\nYang kelihatan rapi di dashboard, belum tentu rapi di lapangan 😅\n\n${DEEP_CAPTION_BODY}\n\n${autoTags}`,
    "Simpan caranya di rumah.",
  ), null, lockup);
  assert.equal(rich.caption.includes("\n"), true);
  assert.equal(rich.caption.includes("😅"), true);
  assert.equal(rich.caption.includes(website), true);
  assert.equal(rich.caption.includes(contact), true);
  assert.equal(captionHashtags(rich.caption).length, 3);
  assert.match(rich.caption, /\n#OtomatisasiProses #EfisiensiKerja #OperasionalTim\s*$/);
  assert.equal(rich.caption.includes("susah dilacak.\n\nYang kelihatan"), true);

  const longBody = [
    "Rantai pasok yang kelihatan rapi di dashboard seringkali justru paling rapuh di lapangan.",
    "Satu supplier macet sebentar, dan stok yang dikira efisien langsung kosong tanpa bantalan.",
    "Banyak tim baru sadar setelah gangguan kecil memicu kerugian besar yang sulit dilacak.",
    "Coba cek dulu: sistem kamu punya cadangan, atau selama ini cuma mengejar efisiensi maksimal?",
    "Kalau mau bahas lebih lanjut soal cadangan dan resiliensi, silakan hubungi kami ya.",
  ].join("\n\n");
  const supplyTags = "#ManajemenRantaiPasok #ResiliensiBisnis #Operasional";
  const deep = parseCarouselDraft(body(`${longBody}\n\n${supplyTags}`, "Simpan caranya di rumah."), null, lockup);
  assert.ok(deep);
  assert.ok(deep.caption.length > 350);
  assert.ok(deep.caption.length <= 800);
  assert.equal(deep.caption.includes(website), true);
  assert.equal(captionHashtags(deep.caption).length, 3);
  assert.equal(deep.caption.includes("#ManajemenRantaiPasok"), true);

  const oneTag = parseCarouselDraft(body(`${DEEP_CAPTION_BODY}\n\n#sate`, "Simpan caranya di rumah."), null, lockup);
  assert.ok(oneTag);
  assert.equal(captionHashtags(oneTag.caption).length >= 3, true);
  const manyTags = parseCarouselDraft(body(`${DEEP_CAPTION_BODY}\n\n#alpha #beta #gamma #delta #epsilon #zeta`, "Simpan caranya di rumah."), null, lockup);
  assert.ok(manyTags);
  assert.equal(captionHashtags(manyTags.caption).length, 5);

  // Body fills the cap; reserved footer keeps contacts + brand hashtags.
  const tooLong = `${"Paragraf sadar bahaya tersembunyi. ".repeat(28)}\n\n${CAPTION_TAGS}`;
  const lockupWithTags = {
    ...lockup,
    hashtags: ["#HRTech", "#SolusiHR", "#OperasionalTim"],
  };
  const fitted = parseCarouselDraft(body(tooLong, "Simpan caranya di rumah."), null, lockupWithTags);
  assert.ok(fitted);
  assert.ok(fitted.caption.length <= 800);
  assert.equal(fitted.caption.includes(website), true);
  assert.equal(fitted.caption.includes(contact), true);
  assert.deepEqual(captionHashtags(fitted.caption), lockupWithTags.hashtags);
  assert.equal(carouselNotesOk(fitted, null, lockupWithTags), true);
});

test("salinan judul, headline, dan badan ditolak sebelum disimpan", () => {
  const prior = {
    title: "Garansi Daging Empuk Sate Sultan PIK",
    hook: "Sate Kambing Alot? Itu Dulu!",
    opening: "Pernah kecewa karena daging sate kambing yang alot?",
    lines: [
      "Pernah kecewa karena daging sate kambing yang alot?",
      "Laporan audit mengumpulkan rating pengunjung tentang tekstur daging.",
      "Catatan kunjungan dibandingkan satu per satu sampai polanya terlihat.",
    ],
  };
  const titleCopy = {
    title: "Garansi Daging Empuk di Sate Sultan PIK",
    slides: [{
      vo: "Pengunjung menulis catatan rasa setiap kali datang.",
      element: "Hook headline: Catatan rasa minggu ini. Visual hook: buku catatan.",
    }, {
      vo: "Satu kunjungan tidak cukup untuk menilai konsistensi.",
      element: "daftar tanggal",
    }],
  };
  assert.equal(copyCollides(titleCopy, [prior])?.field, "title");

  const openingCopy = {
    title: "Audit ulasan sate minggu ini",
    slides: [{
      vo: "Pernah kecewa karena daging sate kambing yang alot?",
      element: "Hook headline: Menu lain sama sekali. Visual hook: piring kosong.",
    }, {
      vo: "Ulasan publik dibanding satu per satu.",
      element: "tabel",
    }],
  };
  assert.equal(copyCollides(openingCopy, [prior])?.field, "opening");

  const hookCopy = {
    title: "Balasan untuk komentar tekstur",
    slides: [{
      vo: "Komentar itu bilang empuknya hanya kebetulan.",
      element: "Hook headline: Sate Kambing Alot? Itu Dulu! Visual hook: komentar.",
    }, {
      vo: "Jawabannya adalah kunjungan yang berulang.",
      element: "kutipan",
    }],
  };
  assert.equal(copyCollides(hookCopy, [prior])?.field, "opening");

  const bodyCopy = {
    title: "Laporan kunjungan yang berbeda",
    slides: [{
      vo: "Komentar haters menanyakan bukti, bukan janji.",
      element: "Hook headline: Bukan kebetulan sekali. Visual hook: kompilasi video.",
    }, {
      vo: prior.lines[1],
      element: "bukti",
    }, {
      vo: prior.lines[2],
      element: "bukti",
    }],
  };
  assert.equal(copyCollides(bodyCopy, [prior])?.field, "body");

  const other = {
    title: "Rahasia Daging Kambing Empuk Muda lawan Tua",
    slides: [{
      vo: "Serat daging muda lebih pendek daripada daging tua.",
      element: "Hook headline: Muda atau tua beda serat. Visual hook: dua potongan.",
    }, {
      vo: "Hubungi kami 085923305709",
      element: "tombol",
    }],
  };
  const phonePrior = {
    title: "Jam buka akhir pekan",
    hook: "Datang sebelum magrib",
    opening: "Pesan tempat untuk keluarga besar.",
    lines: ["Pesan tempat untuk keluarga besar.", "Nomor reservasi 085923305709"],
  };
  assert.equal(copyCollides(other, [prior, phonePrior]), null);

  const newest = selectCopyPriors([
    { title: "Lama", service_id: "svc-a", post_date: "2026-11-01", lines: ["satu"] },
    { title: "Lain merek", service_id: "svc-b", post_date: "2026-11-12", lines: ["dua"] },
    { title: "Baru", service_id: "svc-a", post_date: "2026-11-12", lines: ["tiga"] },
  ], "svc-a", 8);
  assert.deepEqual(newest.map((row) => row.title), ["Baru", "Lama"]);

  const sop = buildSop1Prompt({
    day: "2026-11-12",
    pillar: { id: pillarId, name: "Audit Akun Publik" },
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [{
      post_date: "2026-11-12",
      title: prior.title,
      pillar_name: "Audit Akun Publik",
      author_name: "Yudha",
      hook: prior.hook,
      opening: prior.opening,
    }],
    brief: { service_ids: ["svc-a"], services: [], required_notes: "", forbidden_notes: "" },
    performance: [],
    service: { id: "svc-a", name: "Sate" },
    path: { development: "Bedah ulasan publik tentang konsistensi rasa.", prompt_voice: "tenang", is_repeat: false },
    avoid: `Judul terlalu mirip dengan "${prior.title}".`,
  });
  assert.match(sop, /Garansi Daging Empuk Sate Sultan PIK/);
  assert.match(sop, /Sate Kambing Alot/);
  assert.match(sop, /Bedah ulasan publik/);
  assert.match(sop, /Jangan memakai judul, headline, atau kalimat slide 1/);
  assert.match(sop, /Tulis ulang/);

  const check = buildExecutionCheckPrompt({
    day: "2026-11-12",
    pillar: { id: pillarId, name: "Baca Komen Haters" },
    idea: { idea_statement: "Video ulasan konsistensi" },
    draft: hookCopy,
    path: { development: "Balas komentar empuknya cuma kebetulan dengan kompilasi video." },
    priors: [{ title: prior.title, hook: prior.hook, opening: prior.opening }],
  });
  assert.match(check, /Komentar itu bilang empuknya hanya kebetulan/);
  assert.match(check, /Balas komentar empuknya cuma kebetulan/);
  assert.match(check, /messageStays gagal bila headline/);
  assert.doesNotMatch(check, /Gagalkan hanya bila/);

  const ordered = orderCopyFallbackPaths([
    { idea_id: "idea-b", content_pillar_id: "p2", angle_id: "angle-first" },
    { idea_id: "idea-a", content_pillar_id: "p1", angle_id: "angle-first" },
    { idea_id: "idea-a", content_pillar_id: "p8", angle_id: "angle-first" },
    { idea_id: "idea-c", content_pillar_id: "p9", angle_id: "angle-other" },
  ], "idea-a", "p1");
  assert.deepEqual(ordered.map((row) => `${row.idea_id}:${row.content_pillar_id}`), [
    "idea-a:p1",
    "idea-c:p9",
    "idea-b:p2",
    "idea-a:p8",
  ]);

  const source = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  assert.match(source, /copyCollides/);
  assert.match(source, /attempt <= draftAttempts/);
  assert.match(source, /MAX_DRAFT_ATTEMPTS/);
  assert.match(source, /rememberCopy/);
  assert.match(source, /orderCopyFallbackPaths/);
  assert.match(source, /ideaTries > ideaCap/);
});

test("run fokus tidak mengisi ulang path setelah antrean ditolak", () => {
  const source = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /MAX_PATH_REFILLS/);
  assert.doesNotMatch(source, /MAX_REFILL_PATH_ATTEMPTS/);
  assert.doesNotMatch(source, /refillCarouselPath/);
  assert.match(source, /rejectedIdeaIds\.has\(candidates\[index\]\.id\)/);
  assert.match(source, /new Set\(\[\.\.\.takenPairs, \.\.\.extraBlocked\]\)/);
  assert.match(source, /while \(attempts < maxAttempts\)/);
  assert.match(source, /blockedFromCooldown/);
  assert.match(source, /cooledIdeas/);
  assert.match(source, /const skipIdea = /);
  assert.match(source, /!pathBlocked\(row\)/);
  assert.match(source, /usableQueued/);
  assert.match(source, /queuedIdeaIds/);
  assert.doesNotMatch(source, /sop1_cooldown_lifted/);
  assert.doesNotMatch(source, /buildCarouselPathCheckPrompt/);
});

test("klaim Product Knowledge boleh diulang di badan slide, judul tetap dicek", () => {
  const claimTokens = copyClaimTokens([{
    service_name: "Sate Sultan PIK",
    feature_name: "Daging Empuk",
    competitive_advantage: "Garansi rasa, Sop sum sum kambing di sate sultan PIK pasti empuk",
  }]);
  const prior = {
    title: "Sate Kambing Tanpa Bau Prengus: Mitos atau Fakta?",
    hook: "Sate Kambing Bau Prengus? MITOS ATAU FAKTA?",
    opening: "Pernahkah kamu ragu makan sate kambing karena takut bau prengus?",
    lines: [
      "Pernahkah kamu ragu makan sate kambing karena takut bau prengus?",
      "Garansi rasa: daging kambing Sate Sultan PIK pasti empuk!",
      "Kami berikan garansi rasa, sate sumsum kambing di Sate Sultan PIK pasti empuk!",
    ],
  };
  const draft = {
    title: "Jurnal Rasa: Catatan Keempukan Tiap Kunjungan",
    slides: [
      { vo: "Coba catat rasa sate tiap kali kamu datang.", element: "Hook headline: Kamu Punya Jurnal Rasa? Visual hook: buku catatan" },
      { vo: "Garansi rasa, daging kambing di Sate Sultan PIK pasti empuk!" },
      { vo: "Kami berikan garansi rasa: sate kambing Sate Sultan PIK pasti empuk." },
    ],
  };
  assert.equal(copyCollides(draft, [prior])?.field, "body");
  assert.equal(copyCollides(draft, [prior], { claimTokens }), null);
  const sameTitle = { ...draft, title: prior.title };
  assert.equal(copyCollides(sameTitle, [prior], { claimTokens })?.field, "title");
});

test("penolakan copy dicatat dengan bagian dan judul pembandingnya", () => {
  const source = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  assert.match(source, /copyCollides\(candidate, compared, \{ claimTokens \}\)/);
  assert.match(source, /lastReject = `copy:\$\{collision\.field\}@/);
  assert.match(source, /event: "sop1_copy_reject"/);
});

test("penolakan pembuka menyebut kalimat lama yang harus dihindari", () => {
  const prior = {
    title: "Garansi Daging Empuk Sate Sultan PIK",
    hook: "Sate Kambing Alot? Itu Dulu!",
    opening: "Pernah kecewa karena daging sate kambing yang alot?",
    lines: ["Pernah kecewa karena daging sate kambing yang alot?"],
  };
  const draft = {
    title: "Jurnal Rasa: Catatan Tiap Kunjungan",
    slides: [{ vo: "Pernah kecewa sama daging sate kambing yang alot?", element: "Hook headline: Catat Rasamu Visual hook: buku" }],
  };
  const hit = copyCollides(draft, [prior]);
  assert.equal(hit?.field, "opening");
  assert.equal(hit?.used, "Pernah kecewa karena daging sate kambing yang alot?");
  assert.match(hit?.reason ?? "", /sudah memakai: "Pernah kecewa karena daging sate kambing yang alot\?"/);
});

test("prompt SOP1 meminta bahasa lisan dan judul dari Idea", () => {
  const draft = readFileSync(new URL("../../supabase/functions/_shared/aiEmployee/planDraft.mjs", import.meta.url), "utf8");
  assert.match(draft, /Sapa penonton dengan kamu, bukan Anda/);
  assert.match(draft, /title dan Hook headline berangkat dari Idea dan Development pilar, bukan dari klaim Product Knowledge/);
  assert.match(draft, /Scene Visual wajib matching Hook headline/);
  assert.match(draft, /Jangan mengunci kreativitas Canva/);
  assert.match(draft, /ukuran standar antar slide/);
  const source = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  assert.match(source, /checkId === "usesSlang"/);
  assert.match(source, /checkId === "soundsSpoken"/);
});

test("menu pilihan draft: maksimal 3, unik, hanya dari daftar menu", () => {
  const sate = "11111111-1111-4111-8111-111111111111";
  const sop = "22222222-2222-4222-8222-222222222222";
  const babi = "33333333-3333-4333-8333-333333333333";
  const nasi = "44444444-4444-4444-8444-444444444444";
  assert.deepEqual(pickMenuIds([sate, sate, "bukan-id", sop, babi, nasi]), [sate, sop, babi]);
  assert.deepEqual(pickMenuIds([babi, sate], [sate, sop]), [sate]);
  assert.deepEqual(pickMenuIds("bukan array"), []);
});

test("prompt SOP1 menyertakan daftar menu dan meminta sub_service_ids", () => {
  const menus = [
    { id: "11111111-1111-4111-8111-111111111111", name: "Sate Kambing Full Daging" },
    { id: "33333333-3333-4333-8333-333333333333", name: "Sate Babi Sultan Asin" },
  ];
  const prompt = buildSop1Prompt({ day: "2026-11-13", pillar: { id: "p", name: "Edukasi" }, steps: [], catalog: [], thinking: [], feedback: [], plans: [], brief: {}, performance: [], service: { id: "s", name: "Sate Sultan PIK" }, idea: null, product: [], menus });
  assert.match(prompt, /Tambahkan kunci sub_service_ids/);
  assert.match(prompt, /sate kambing bukan sate babi atau sate ayam/);
  assert.match(prompt, /Sate Kambing Full Daging/);
  const without = buildSop1Prompt({ day: "2026-11-13", pillar: { id: "p", name: "Edukasi" }, steps: [], catalog: [], thinking: [], feedback: [], plans: [], brief: {}, performance: [], service: null, idea: null, product: [] });
  assert.doesNotMatch(without, /sub_service_ids/);
});

test("run menyimpan menu pilihan dan Canva hanya mengirim foto menu itu", () => {
  const run = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  assert.match(run, /sub_service_library_photos/);
  assert.match(run, /pickMenuIds\(draftMenus, menuIds\)/);
  assert.match(run, /update\(\{ sub_service_id: pickedMenus\[0\], sub_service_ids: pickedMenus \}\)/);
  assert.match(run, /\.\.\.planPayload,/);
  const canva = readFileSync(new URL("../../supabase/functions/canva-carousel-run/index.ts", import.meta.url), "utf8");
  assert.match(canva, /select\("pic_id, organization_id, sub_service_id, sub_service_ids"\)/);
  assert.match(canva, /if \(picked\.length > 0\) return libraryPhotos/);
});

test("ekspor Canva pertama mencatat Prod Completion tanpa mengubah status", () => {
  const canva = readFileSync(new URL("../../supabase/functions/canva-carousel-run/index.ts", import.meta.url), "utf8");
  assert.match(canva, /async function markProductionDone/);
  assert.match(canva, /\.is\("production_completion_date", null\)/);
  assert.match(canva, /\.or\("production_status\.is\.null,production_status\.eq\.Need Review"\)/);
  assert.equal(canva.match(/await markProductionDone\(admin, planId\);/g)?.length, 2);
});

test("Canva memasang foto dan logo lewat tool edit yang tersedia", () => {
  const canva = readFileSync(new URL("../../supabase/functions/canva-carousel-run/index.ts", import.meta.url), "utf8");
  assert.match(canva, /canvaEditingMode\(await listCanvaMcpTools\(token\)\)/);
  assert.match(canva, /"start-editing-transaction", \{\s*design_id: designId/);
  assert.match(canva, /"perform-editing-operations", \{\s*transaction_id: session\.transactionId,\s*pages: session\.rawPages/);
  assert.match(canva, /"commit-editing-transaction" : "cancel-editing-transaction"/);
  assert.match(canva, /"read-design", \{\s*design_id: designId,\s*open_transaction: true/);
  assert.match(canva, /finalize: "keep_open"/);
  assert.match(canva, /payload\.media_id/);
  assert.doesNotMatch(canva, /placeProductPhotos/);
  assert.match(canva, /menus: productPhotos\.map\(\(photo\) => photo\.name\)/);
  const mcp = readFileSync(new URL("../../supabase/functions/_shared/canvaMcp.ts", import.meta.url), "utf8");
  assert.match(mcp, /"read-design",\n  "edit-design",/);
  assert.match(mcp, /export function canvaEditingMode/);
});

test("revisi Canva memakai jalur lama bila tersedia, atau read-design + edit-design", () => {
  const revise = readFileSync(new URL("../../supabase/functions/canva-carousel-run/revise.ts", import.meta.url), "utf8");
  assert.match(revise, /editingMode = canvaEditingMode\(tools\)/);
  for (const legacy of ["start-editing-transaction", "perform-editing-operations", "commit-editing-transaction", "cancel-editing-transaction"]) {
    assert.match(revise, new RegExp(`"${legacy}"`));
  }
  assert.match(revise, /open_transaction: true/);
  assert.match(revise, /finalize: "commit"/);
  assert.match(revise, /operations: operations\.map\(toEditOperation\)/);
  assert.match(revise, /uploaded\.payload\.media_id/);
});

test("run berhenti sebelum batas 150 detik dan retry draf memakai temperature lebih tinggi", () => {
  const run = readFileSync(new URL("../../supabase/functions/ai-employee-run/index.ts", import.meta.url), "utf8");
  assert.match(run, /const RUN_TIME_BUDGET_MS = 105_000;/);
  assert.match(run, /const MIN_MODEL_REMAINING_MS = 35_000;/);
  assert.match(run, /if \(remainingMs\(\) <= 0\) \{\s*timeBudgetHit = true;\s*return \{ kind: "quota" \};/);
  assert.match(run, /if \(label === "quota" && timeBudgetHit\) label = "time_budget";/);
  assert.match(run, /\}\), avoid \? RETRY_TEMPERATURE : 0\);/);
  assert.match(run, /remainingMs\(\) < MIN_MODEL_REMAINING_MS/);
  const call = scriptAiCall({ url: "https://x.supabase.co", serviceRoleKey: "k", organizationId: "o", userId: "u", prompt: "p", temperature: 0.7 });
  assert.equal(JSON.parse(call.init.body).temperature, 0.7);
  assert.equal(JSON.parse(scriptAiCall({ url: "https://x.supabase.co", serviceRoleKey: "k", organizationId: "o", userId: "u", prompt: "p" }).init.body).temperature, 0);
});

test("brief boleh 6 fokus angle dan prompt menu tidak menjanjikan foto asli", () => {
  const page = readFileSync(new URL("../../src/2-1-employees/ai/AiEmployeePage.tsx", import.meta.url), "utf8");
  assert.match(page, /const MAX_BRIEF_ANGLES = 6;/);
  assert.doesNotMatch(page, /value\.length >= 3;/);
  const migration = readFileSync(new URL("../../supabase/migrations/20261113090000_ai_employee_brief_six_angles.sql", import.meta.url), "utf8");
  assert.match(migration, /cardinality\(angle_ids\) <= 6/);
  assert.match(migration, /'cardinality\(v_angles\) > 6'/);
  const draft = readFileSync(new URL("../../supabase/functions/_shared/aiEmployee/planDraft.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(draft, /Foto asli menu terpilih akan dipasang/);
  assert.match(draft, /Desainer menggambar produk dari nama menu ini/);
});

test("rotasi referensi: slot yang belum dipakai dulu, lalu yang paling lama", () => {
  assert.equal(rotateReference([1, 2, 3], ["x Referensi 1", "y Referensi 1"]), 2);
  assert.equal(rotateReference([1, 2, 3], ["Referensi 2", "Referensi 3", "Referensi 1"]), 1);
  assert.equal(rotateReference([1, 2, 3], ["Referensi 3", "Referensi 1", "Referensi 2"]), 2);
  assert.equal(rotateReference([4, 2], []), 2);
  assert.equal(rotateReference([], ["Referensi 1"]), null);
  assert.equal(rotateReference([1, 2], ["Referensi 5"]), 1);
});

test("brief dibatasi ke satu slot referensi", () => {
  const brief = { voice: "v", references: [{ position: 1 }, { position: 3 }] };
  assert.deepEqual(briefWithReference(brief, 3).references, [{ position: 3 }]);
  assert.equal(briefWithReference(brief, null), brief);
  assert.equal(briefWithReference(brief, 2), brief);
});

test("judul slide dibaca dari Hook headline atau Headline, berhenti di Arah gambar", () => {
  assert.equal(hookFromElement("Hook headline: Alot? Bye-bye! Visual hook: Sate. Arah gambar: panah"), "Alot? Bye-bye!");
  assert.equal(hookFromElement("Hook headline: Alot? Arah gambar: panah ke daging. Visual hook: Sate"), "Alot?");
  assert.equal(headlineFromElement("Headline: Garansi Daging Empuk. Point: Kambing muda. Referensi 2"), "Garansi Daging Empuk");
  assert.equal(headlineFromElement("Headline: Serat Halus. Arah gambar: panah ke serat"), "Serat Halus");
  assert.equal(headlineFromElement("Warna: merah muda"), "");
});

test("judul slide yang berulang hanya dilaporkan", () => {
  const priors = [{ title: "Plan lama", headlines: ["Garansi Rasa Daging Empuk Banget"] }];
  const found = headlineRepeats(["Garansi Rasa Daging Empuk Banget", "Serat Halus Kambing Muda"], priors);
  assert.equal(found.length, 1);
  assert.equal(found[0].prior_title, "Plan lama");
  assert.equal(headlineRepeats(["Judul baru sama sekali beda"], priors).length, 0);
});

test("prompt SOP1 meminta Headline, Arah gambar, dan vo paling banyak 12 kata", () => {
  const prompt = buildSop1Prompt({ day: "2026-11-14", pillar: { id: "p", name: "P" }, steps: [], catalog: [], thinking: [], feedback: [], plans: [], brief: null, performance: [], service: null, idea: null, product: [] });
  assert.match(prompt, /paling banyak 12 kata/);
  assert.match(prompt, /'Headline: \.\.\.'/);
  assert.match(prompt, /'Arah gambar: \.\.\.'/);
});

test("gaya pembuka bergilir dan pembuka lama dilarang sejak percobaan pertama", () => {
  const seen = new Set(Array.from({ length: 6 }, (_, index) => openingStyleFor(index).id));
  assert.equal(seen.size, 6);
  assert.equal(openingStyleFor(6).id, openingStyleFor(0).id);
  assert.equal(openingStyleFor(-1).id, openingStyleFor(5).id);
  const priors = [
    { title: "A", opening: "Pernah nggak sih kamu makan sate kambing tapi dagingnya alot?", hook: "Daging Kambing Alot? Bye-bye deh!" },
    { title: "B", opening: "Pernah nggak sih kamu bingung milih daging?", hook: "" },
  ];
  const used = usedOpenings(priors);
  assert.equal(used.phrases.includes("Pernah nggak sih kamu makan sate kambing tapi dagingnya alot?"), true);
  assert.deepEqual(used.starts, ["pernah nggak sih"]);
  const prompt = buildSop1Prompt({ day: "2026-11-14", pillar: { id: "p", name: "P" }, steps: [], catalog: [], thinking: [], feedback: [], plans: priors, brief: null, performance: [], service: null, idea: null, product: [], openingStyle: openingStyleFor(0) });
  assert.match(prompt, /Gaya pembuka slide 1 wajib: Fakta mengejutkan/);
  assert.match(prompt, /Jangan memulai Hook headline atau vo slide 1 dengan kata-kata ini: \["pernah nggak sih"\]/);
  assert.match(prompt, /Pernah nggak sih kamu makan sate kambing tapi dagingnya alot\?/);
});

test("SOP1 menaruh Idea sebagai inti dan menyebut sudut yang sudah sering", () => {
  const titles = [
    "Daging Kambing Empuk vs. Alot, Kok Bisa Beda?",
    "Daging Kambing Empuk Anti Prengus, Ada Kok!",
    "Perbedaan Daging Kambing Muda dan Tua: Pilih Mana?",
    "Beda Daging Kambing Muda vs Tua, Mana yang Lebih Empuk?",
    "Garansi Daging Empuk Sate Sultan PIK",
    "Rahasia Daging Kambing Empuk: Muda vs. Tua",
  ];
  const topics = usedTopicPhrases(titles, ["Sate Sultan PIK", "Sate Kambing Full Daging"]);
  assert.ok(topics.some((row) => row.phrase === "muda tua" && row.count === 3));
  assert.ok(!topics.some((row) => row.phrase === "daging kambing"), "catalog words alone are not an angle");
  assert.deepEqual(usedTopicPhrases(["Charger cepat panas?", "Kabel rusak"], ["Charger 20W"]), []);
  const prompt = buildSop1Prompt({
    day: "2026-11-13",
    pillar: { id: "alfa", name: "Alfa" },
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    idea: { idea_id: "i1", idea_statement: "Ulasan yang membedakan ramai karena kualitas dan ramai karena kapasitas" },
    usedTopics: topics,
  });
  assert.match(prompt, /Inti carousel ini adalah Idea berikut, bukan klaim Product Knowledge: "Ulasan yang membedakan/);
  assert.match(prompt, /Sudut yang sudah sering dipakai rencana terakhir: .*muda tua \(3x\)/);
  const bare = buildSop1Prompt({ day: "2026-11-13", pillar: { id: "alfa" }, steps: [], catalog: [], thinking: [], feedback: [], plans: [] });
  assert.doesNotMatch(bare, /Sudut yang sudah sering/);
  const check = buildExecutionCheckPrompt({ day: "2026-11-13", pillar: { id: "alfa" }, idea: { idea_statement: "x" }, draft: { title: "t", slides: [] } });
  assert.match(check, /mechanismVisible gagal bila judul, hook, dan alur slide tidak membawa mekanisme idea_statement/);
});

test("Brand lockup hashtags menimpa caption dan prompt melarang mengarang tag", () => {
  const forced = placeLockupHashtags("Body caption tanpa tag", ["#LaporanBisnis", "#AnalisisWhatIf", "#SynckerjaOffice"]);
  assert.equal(captionHashtags(forced).join(" "), "#LaporanBisnis #AnalisisWhatIf #SynckerjaOffice");
  assert.match(forced, /Body caption tanpa tag/);
  const lockup = brandLockupFromBrief({
    company_logo_id: "11111111-1111-4111-8111-111111111111",
    company_logos: [{
      id: "11111111-1111-4111-8111-111111111111",
      tagline: "Measuring",
      website_url: "https://synckerja.com/",
      default_contact: "081118891308",
      hashtags: ["#LaporanBisnis", "#AnalisisWhatIf", "#SynckerjaOffice"],
      logo_path: "org/x.png",
    }],
  }, { name: "Synckerja Office" });
  assert.deepEqual(lockup.hashtags, ["#LaporanBisnis", "#AnalisisWhatIf", "#SynckerjaOffice"]);
  const prompt = buildSop1Prompt({
    day: "2026-11-15",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: {
      company_logo_id: lockup.hasLogo ? "11111111-1111-4111-8111-111111111111" : "",
      company_logos: [{
        id: "11111111-1111-4111-8111-111111111111",
        hashtags: lockup.hashtags,
        website_url: lockup.website,
        default_contact: lockup.defaultContact,
        logo_path: "org/x.png",
      }],
    },
    service: { id: "svc", name: "Synckerja Office" },
    idea: { idea_id: "i1", idea_statement: "Ide laporan" },
    product: [],
  });
  assert.match(prompt, /Hashtag caption sudah disediakan Brand lockup/);
  assert.match(prompt, /#LaporanBisnis #AnalisisWhatIf #SynckerjaOffice/);
  const accepted = parseCarouselDraft(JSON.stringify({
    title: "Judul uji",
    post_date: "2026-11-15",
    caption: DEEP_CAPTION_BODY,
    concept: "Konten ini dibuat karena penonton masih mengandalkan laporan historis tanpa prediksi.",
    slides: [
      {
        timing: "Slide 1",
        visual: "Dua laporan di meja, kiri historis kanan prediktif.",
        vo: "Coba bandingkan",
        element: "Hook headline: Historis vs prediktif. Visual hook: Dua laporan berdampingan.",
        tagging: "",
      },
      {
        timing: "Slide 2",
        visual: "Tim membaca insight what-if di layar.",
        vo: "Geser lanjut",
        element: "Headline: What-if lebih jelas.",
        tagging: "",
      },
    ],
  }), null, {
    websiteUrl: lockup.website,
    defaultContact: lockup.defaultContact,
    hashtags: lockup.hashtags,
  });
  assert.ok(accepted);
  assert.deepEqual(captionHashtags(accepted.caption), lockup.hashtags);
});

test("Hook sistem masuk prompt; placeholder mentah ditolak", () => {
  const hook = pickSystemHook([
    { id: "1", name: "Kalau Mau [X] Ngapain [Y]", hook_content: "Contoh: Kalau mau untung ngapain rugi" },
    { id: "2", name: "Dulu [X] Sekarang [Y]", hook_content: "Contoh: Dulu manual sekarang otomatis" },
  ], 1);
  assert.equal(hook?.name, "Dulu [X] Sekarang [Y]");
  const lines = systemHookPromptLines(hook);
  assert.ok(lines.some((line) => /Template Hook headline wajib/.test(line)));
  const prompt = buildSop1Prompt({
    day: "2026-11-15",
    pillar: pillars[0],
    steps: [],
    catalog: [],
    thinking: [],
    feedback: [],
    plans: [],
    brief: null,
    service: null,
    idea: { idea_id: "i1", idea_statement: "Ide" },
    product: [],
    systemHook: hook,
  });
  assert.match(prompt, /Brief meminta pakai hook sistem Product Knowledge/);
  assert.match(prompt, /Dulu \[X\] Sekarang \[Y\]/);
  assert.equal(hookHasRawPlaceholders("Hook headline: Kalau Mau [X] Ngapain [Y]. Visual hook: Layar."), true);
  assert.equal(hookHasRawPlaceholders("Hook headline: Dulu manual sekarang otomatis. Visual hook: Layar."), false);
  assert.equal(diagnoseCarouselDraft(JSON.stringify({
    title: "Judul",
    post_date: "2026-11-15",
    caption: DEEP_CAPTION,
    concept: "Konten ini dibuat karena penonton sering menebak solusi tanpa melihat masalah yang sebenarnya.",
    slides: [
      {
        timing: "Slide 1",
        visual: "Adegan pembuka yang jelas.",
        vo: "Coba lihat",
        element: "Hook headline: Kalau Mau [X] Ngapain [Y]. Visual hook: Panah ke angka.",
        tagging: "",
      },
      {
        timing: "Slide 2",
        visual: "Adegan penutup.",
        vo: "Lanjut",
        element: "Headline: Penutup singkat.",
        tagging: "",
      },
    ],
    content_pillar_id: pillarId,
  })), "hook");
});

test("generate-script-ai carousel prefix tidak memaksa caption satu kalimat pendek", () => {
  const source = readFileSync(new URL("../../supabase/functions/generate-script-ai/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /one short Indonesian sentence/);
  assert.match(source, /const CAPTION_BODY_FLOOR = 200/);
  assert.match(source, /const CAPTION_BODY_TARGET_MIN = 350/);
  assert.match(source, /const CAPTION_BODY_TARGET_MAX = 550/);
  assert.match(source, /const HOOK_MAX_WORDS = 8/);
  assert.match(source, /const VO_MAX_WORDS = 12/);
  assert.match(source, /CAPTION_BODY_TARGET_MIN\}-\$\{CAPTION_BODY_TARGET_MAX/);
  assert.match(source, /takeAround\("Wajib:"/);
  assert.match(source, /takeAround\("Panjang caption body"/);
  assert.match(source, /real newline characters/);
  assert.match(source, /const CAPTION_LIMIT = 800/);
  assert.match(source, /caption\.length > CAPTION_LIMIT/);
  assert.match(source, /function normalizeCarouselCaption/);
  assert.match(source, /normalizeCarouselCaption\(value\.caption/);
  assert.match(source, /CAROUSEL_MAX_TOKENS/);
  assert.doesNotMatch(source, /max_tokens: 1800/);
  assert.doesNotMatch(source, /caption\.length > 400/);
  assert.doesNotMatch(source, /let caption = cell\(value\.caption/);
});
