/**
 * Display constants for Content Plan Carousel generate rules (Advanced Brief).
 * Keep in sync with:
 * - supabase/functions/_shared/aiEmployee/planDraft.mjs
 *   (CAPTION_*, HOOK_MAX_WORDS, VO_MAX_WORDS, EXECUTION_CHECK_IDS)
 * - supabase/functions/ai-employee-run/index.ts (MAX_DRAFT_ATTEMPTS)
 * Frontend does not import edge .mjs — mirror numbers here for UI only.
 */
export const CAROUSEL_GENERATE_RULES = {
  slidesMin: 2,
  slidesMax: 10,
  captionBodyFloor: 200,
  captionBodyTargetMin: 350,
  captionBodyTargetMax: 550,
  captionTotalCap: 800,
  hookMaxWords: 8,
  voMaxWords: 12,
  hashtagMin: 3,
  hashtagMax: 5,
  executionCheckCount: 10,
  maxDraftAttempts: 3,
  maxDraftAttemptsTight: 2,
} as const;

/**
 * Same order/ids as planDraft.mjs EXECUTION_CHECK_IDS (one model call, 10 statuses).
 * Keep in sync when edge list changes.
 */
export const CAROUSEL_EXECUTION_CHECK_IDS = [
  "hookHolds",
  "soundsSpoken",
  "usesSlang",
  "pillarFits",
  "formatHolds",
  "mechanismVisible",
  "messageStays",
  "causeChain",
  "viewerClimb",
  "emotionalTone",
] as const;

export type CarouselExecutionCheckId = (typeof CAROUSEL_EXECUTION_CHECK_IDS)[number];

/** Indonesian labels for Brief Advanced + generate progress. */
export const CAROUSEL_EXECUTION_CHECK_LABELS: Record<CarouselExecutionCheckId, string> = {
  hookHolds: "Hook slide 1 tetap kuat",
  soundsSpoken: "Bahasa terdengar lisan",
  usesSlang: "Tidak terlalu formal / ada slang wajar",
  pillarFits: "Sesuai pilar konten",
  formatHolds: "Format carousel tetap dipegang",
  mechanismVisible: "Ide / mekanisme terlihat di draf",
  messageStays: "Tidak mengulang plan terakhir",
  causeChain: "Rantai sebab–akibat jelas",
  viewerClimb: "Penonton naik level pemahaman",
  emotionalTone: "Nada emosional konsisten",
};

export function carouselExecutionCheckLines(): { id: CarouselExecutionCheckId; label: string }[] {
  return CAROUSEL_EXECUTION_CHECK_IDS.map((id) => ({
    id,
    label: CAROUSEL_EXECUTION_CHECK_LABELS[id],
  }));
}

/** Short lines for the read-only Advanced Brief panel. */
export function carouselSystemRulesLines(): string[] {
  const r = CAROUSEL_GENERATE_RULES;
  return [
    `Slide: ${r.slidesMin}–${r.slidesMax}`,
    `Caption body: floor ${r.captionBodyFloor} / target ${r.captionBodyTargetMin}–${r.captionBodyTargetMax} / total cap ${r.captionTotalCap} (footer kontak + hashtag sistem)`,
    `Hook headline ≤ ${r.hookMaxWords} kata; vo ≤ ${r.voMaxWords} kata (batas terpisah)`,
    `Hashtag: ${r.hashtagMin}–${r.hashtagMax}, atau exact Brand lockup jika lockup ON`,
    "Anti-copy vs plan terakhir (judul / hook / pembuka)",
    `Execution check: ${r.executionCheckCount} poin (bisa dimatikan di saklar di atas)`,
    `Kuota model + retry draf (maks ${r.maxDraftAttempts}; ${r.maxDraftAttemptsTight} jika waktu sempit)`,
  ];
}
