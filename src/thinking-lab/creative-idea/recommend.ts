import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { PillarFitStatus, StoredPillarReview } from "@/thinking-lab/creative-idea/types";
import { PILLAR_REVIEW_LIMIT } from "@/thinking-lab/creative-idea/types";

export type ReviewablePillar = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  funnel?: string | null;
};

export type PillarReview = {
  contentPillarId: string;
  pillarName: string;
  status: PillarFitStatus;
  reason: string;
  development: string;
  offer?: string;
  comment?: string;
  trigger?: string;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clip(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return (space > limit * 0.6 ? cut.slice(0, space) : cut).trim();
}

function wordsOf(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 3);
}

export function selectPillarReviewSet<T extends ReviewablePillar>(
  pillars: readonly T[],
  context: string,
  limit = PILLAR_REVIEW_LIMIT,
): { reviewed: T[]; unreviewed: T[] } {
  const words = wordsOf(context);
  const ranked = [...pillars].sort((left, right) => {
    const score = (pillar: T) => {
      const haystack = `${pillar.name} ${pillar.category ?? ""} ${pillar.description ?? ""}`.toLowerCase();
      return words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    };
    const difference = score(right) - score(left);
    if (difference !== 0) return difference;
    return left.name.localeCompare(right.name);
  });
  const reviewed = ranked.slice(0, Math.max(0, limit));
  const reviewedIds = new Set(reviewed.map((pillar) => pillar.id));
  return {
    reviewed,
    unreviewed: pillars.filter((pillar) => !reviewedIds.has(pillar.id)),
  };
}

function fitStatus(value: string): Exclude<PillarFitStatus, "NOT_REVIEWED"> | null {
  const text = value.toUpperCase().replace(/[\s-]+/g, "_");
  if (text === "RECOMMENDED") return "RECOMMENDED";
  if (text === "POSSIBLE_WITH_ADAPTATION" || text === "POSSIBLE") return "POSSIBLE_WITH_ADAPTATION";
  if (text === "NOT_SUITABLE" || text === "UNSUITABLE") return "NOT_SUITABLE";
  return null;
}

export function parsePillarReviews(raw: unknown, reviewed: readonly ReviewablePillar[]): StoredPillarReview[] {
  const row = asRecord(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(row?.reviews) ? row.reviews : [];
  const seen = new Set<string>();
  return list.flatMap((item) => {
    const entry = asRecord(item);
    if (!entry) return [];
    const named = asText(entry.pillar ?? entry.pillarName ?? entry.name);
    const status = fitStatus(asText(entry.status) || "RECOMMENDED");
    const reason = clip(asText(entry.reason), 500);
    const development = clip(asText(entry.development ?? entry.idea ?? entry.becomes), 700);
    const offer = clip(asText(entry.offer ?? entry.material ?? entry.leadMagnet), 240);
    const comment = clip(asText(entry.comment ?? entry.commentPhrase), 80);
    const trigger = clip(asText(entry.trigger ?? entry.curiosity ?? entry.hook), 240);
    if (!named || status !== "RECOMMENDED" || !reason || !development) return [];
    const match = reviewed.find((pillar) => pillar.name.trim().toLowerCase() === named.toLowerCase());
    if (!match || seen.has(match.id) || development.toLowerCase() === match.name.trim().toLowerCase()) return [];
    seen.add(match.id);
    return [{
      contentPillarId: match.id,
      pillarName: match.name.trim(),
      status: "RECOMMENDED",
      reason,
      development,
      ...(offer ? { offer } : {}),
      ...(comment ? { comment } : {}),
      ...(trigger ? { trigger } : {}),
    }];
  });
}

export function mergePillarReviews(pillars: readonly ReviewablePillar[], parsed: readonly StoredPillarReview[]): PillarReview[] {
  const byId = new Map(parsed.map((review) => [review.contentPillarId, review]));
  return pillars.map((pillar) => {
    const found = byId.get(pillar.id);
    if (!found) return { contentPillarId: pillar.id, pillarName: pillar.name.trim(), status: "NOT_REVIEWED", reason: "", development: "" };
    return found;
  });
}

export function reviewsToStore(reviews: readonly PillarReview[]): StoredPillarReview[] {
  return reviews.flatMap((review) => {
    if (review.status !== "RECOMMENDED" || !review.reason.trim() || !review.development.trim()) return [];
    return [
      {
        contentPillarId: review.contentPillarId,
        pillarName: review.pillarName,
        status: "RECOMMENDED",
        reason: review.reason.trim(),
        development: review.development.trim(),
        ...(review.offer?.trim() ? { offer: review.offer.trim() } : {}),
        ...(review.comment?.trim() ? { comment: review.comment.trim() } : {}),
        ...(review.trigger?.trim() ? { trigger: review.trigger.trim() } : {}),
      },
    ];
  });
}

export type PillarReviewPurpose = "carry" | "lead_magnet";

export const LEAD_MAGNET_PASS_IDS = ["offer", "comment", "trigger", "withheld", "fit"] as const;

export type LeadMagnetPassId = (typeof LEAD_MAGNET_PASS_IDS)[number];

export type LeadMagnetPassCheck = {
  id: LeadMagnetPassId;
  state: "pending" | "running" | "pass" | "fail";
  reason?: string;
};

export type LeadMagnetReviewStep = {
  pillarName: string;
  drafting: boolean;
  checks: LeadMagnetPassCheck[];
};

export function leadMagnetPassChecklist(): LeadMagnetPassCheck[] {
  return LEAD_MAGNET_PASS_IDS.map((id) => ({ id, state: "pending" }));
}

export function buildPillarReviewPrompt(input: {
  context: string;
  pillars: readonly ReviewablePillar[];
  keep?: number;
  excludedNames?: readonly string[];
  purpose?: PillarReviewPurpose;
}): string {
  const keep = input.keep ?? 3;
  const leadMagnet = input.purpose === "lead_magnet";
  const lines = input.pillars.map((pillar) => {
    const detail = [pillar.funnel, pillar.category, clip(pillar.description ?? "", 180)].filter(Boolean).join(" — ");
    return detail ? `- ${pillar.name.trim()}: ${detail}` : `- ${pillar.name.trim()}`;
  });
  const excluded = (input.excludedNames ?? []).map((name) => name.trim()).filter(Boolean);
  return [
    leadMagnet
      ? "Recommend only the pillars listed below where this same conceptual idea can live as lead-magnet content."
      : "Recommend only the pillars listed below that can carry this conceptual idea.",
    "Use a pillar name exactly as listed. Do not invent a pillar.",
    leadMagnet
      ? "The exchange happens in the comment column: the viewer writes one specific comment, and that comment is what opens material they can study, such as a PDF or another learnable piece."
      : "Do not force a pillar to fit. Omit it when you cannot show the idea living in that pillar.",
    ...(leadMagnet
      ? ["Do not force a pillar to fit. Omit a pillar when this idea cannot become that comment-for-material exchange inside it."]
      : []),
    `Return exactly ${keep} recommendations, strongest first. If fewer than ${keep} pillars can carry the idea, return only those that can.`,
    ...(excluded.length > 0
      ? ["These pillars are already locked. Do not recommend them:", ...excluded.map((name) => `- ${name}`)]
      : []),
    leadMagnet
      ? "development shows this same conceptual idea becoming that comment-for-material exchange in the pillar's way of carrying it. Keep the idea's substance."
      : "development shows what this same conceptual idea becomes in that pillar. Keep its substance. Show the pillar's way of carrying it.",
    leadMagnet
      ? "development is not a title, a pillar label, a script, a campaign, or a new idea."
      : "development is not a title, a pillar label, a script, or a new idea.",
    ...(leadMagnet
      ? [
          "offer names the concrete material the viewer receives, drawn from this idea. Say what it is and what the viewer can learn from it.",
          'A bare label such as "study material", "materi", or "PDF" is not an offer.',
          "comment is the exact short phrase, at most eight words, that the viewer must type in the comment column to receive that offer.",
          "Do not read out, list, or teach the steps or strategies that live inside the offer. The content stops before that payoff.",
          "trigger names the one withheld move: what the viewer has just recognized, and the specific thing they still cannot do without the offer. Counting the contents, such as \"5 strategi\", or saying they will be curious, is not a trigger.",
          "development keeps the idea, stops before the payoff, and includes the offer, the exact comment, and that trigger.",
          "reason says why this withheld gap makes the viewer type that comment for that offer. A label is not a reason.",
          "Omit the pillar when you cannot name the offer, the comment, and the withheld trigger.",
        ]
      : ["reason says why this pillar can carry the idea without replacing it. A label is not a reason."]),
    ...(leadMagnet
      ? ["A pillar that only carries the idea, gives the strategies away, or has no withheld trigger, is not a recommendation."]
      : []),
    leadMagnet
      ? "Write development, offer, comment, trigger, and reason in the same language as the idea. Do not switch language."
      : "Write development and reason in the same language as the idea.",
    "Return JSON only:",
    JSON.stringify(
      leadMagnet
        ? { reviews: [{ pillar: "", development: "", offer: "", comment: "", trigger: "", reason: "" }] }
        : { reviews: [{ pillar: "", development: "", reason: "" }] },
    ),
    "",
    "Conceptual idea and its context:",
    input.context.trim(),
    "",
    "Pillars to review:",
    lines.join("\n") || "(none)",
  ].join("\n");
}

const GENERIC_OFFER = /^(study material|learning material|materi|materi belajar|materi yang bisa dipelajari|pdf|a pdf|the pdf|konten|lead magnet|ebook)$/i;

function leadMagnetOffer(value: string | undefined): string {
  const text = clip(asText(value), 180);
  if (text.length < 8 || GENERIC_OFFER.test(text)) return "";
  return text;
}

function leadMagnetComment(value: string | undefined): string {
  const text = clip(asText(value), 80);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 8) return "";
  return text;
}

const GENERIC_TRIGGER = /^(penasaran|ingin tahu|rasa penasaran|curious|curiosity|download|mau download|5 strategi|strategi|solusi praktis|fakta|solusi)$/i;

function leadMagnetTrigger(value: string | undefined): string {
  const text = clip(asText(value), 240);
  if (text.length < 40 || GENERIC_TRIGGER.test(text) || /^\d+\s+strateg/i.test(text)) return "";
  return text;
}

function withLeadMagnetExchange(development: string, offer: string, comment: string, trigger: string): string {
  const text = development.trim();
  const lower = text.toLowerCase();
  const extra = [offer, comment, trigger].filter((part) => part && !lower.includes(part.toLowerCase()));
  return extra.length === 0 ? text : `${text} ${extra.join(" ")}`.trim();
}

export function buildPillarRecommendationCheckPrompt(input: {
  context: string;
  pillar: ReviewablePillar;
  development: string;
  claim: string;
  purpose?: PillarReviewPurpose;
  offer?: string;
  comment?: string;
  trigger?: string;
}): string {
  const detail = [input.pillar.funnel, input.pillar.category, clip(input.pillar.description ?? "", 240)].filter(Boolean).join(" — ");
  const leadMagnet = input.purpose === "lead_magnet";
  return [
    "Check this pillar recommendation. The proposal is not proof.",
    leadMagnet
      ? "PASS only when the development keeps the idea and does not teach the offer's steps, the offer is that missing piece, the comment is an exact short phrase, and the trigger names one concrete move the viewer still cannot make after the content. The claim must explain that withheld gap in the idea's language."
      : "PASS only when the development keeps the conceptual idea and shows how this pillar carries it, and the claim explains that fit.",
    leadMagnet
      ? "FAIL when the offer is missing or generic, the comment is missing, the trigger only counts the contents or says the viewer will be curious, the development already teaches the strategies, or the pillar only fits in general."
      : "FAIL when the development replaces the idea, only names the pillar, or the claim does not show why the pillar fits.",
    "When pass is true, reason is the evidence in the idea's language, in one or two sentences.",
    "When pass is false, reason says what is missing.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Pillar: ${input.pillar.name.trim()}`,
    ...(detail ? [`Pillar detail: ${detail}`] : []),
    "",
    "Conceptual idea:",
    input.context.trim(),
    "",
    "What the idea becomes in this pillar:",
    input.development.trim(),
    ...(leadMagnet
      ? [
          "",
          `Offered material: ${input.offer?.trim() || "(missing)"}`,
          `Comment the viewer must write: ${input.comment?.trim() || "(missing)"}`,
          `Withheld trigger: ${input.trigger?.trim() || "(missing)"}`,
        ]
      : []),
    "",
    "Claimed reason:",
    input.claim.trim(),
  ].join("\n");
}

const LEAD_MAGNET_PASS_RULES: Record<LeadMagnetPassId, { pass: string; fail: string }> = {
  offer: {
    pass: "PASS only when the offered material is a concrete piece this idea can teach, and the viewer can tell what they will study.",
    fail: 'FAIL when the offer is missing, generic, or only a label such as "PDF", "materi", or "5 strategi".',
  },
  comment: {
    pass: "PASS only when the comment is one exact phrase of at most eight words that the viewer must type to receive the offer.",
    fail: "FAIL when the comment is missing or is not a short phrase to type.",
  },
  trigger: {
    pass: "PASS only when the trigger names one concrete move the viewer has recognized but still cannot do, because that move was not spoken.",
    fail: "FAIL when the trigger only counts the contents, repeats the offer, or says the viewer will be curious.",
  },
  withheld: {
    pass: "PASS only when the development stops before the offer's steps and does not read, list, or teach them.",
    fail: "FAIL when the development already gives the strategies away.",
  },
  fit: {
    pass: "PASS only when the claim explains that withheld gap in the idea's language, in one or two sentences.",
    fail: "FAIL when the claim only says the pillar fits in general.",
  },
};

export function buildLeadMagnetPassPrompt(input: {
  id: LeadMagnetPassId;
  context: string;
  pillar: ReviewablePillar;
  development: string;
  claim: string;
  offer: string;
  comment: string;
  trigger: string;
}): string {
  const rule = LEAD_MAGNET_PASS_RULES[input.id];
  const detail = [input.pillar.funnel, input.pillar.category, clip(input.pillar.description ?? "", 240)].filter(Boolean).join(" — ");
  return [
    "Check this lead-magnet requirement. The proposal is not proof.",
    rule.pass,
    rule.fail,
    "When pass is true, reason is the evidence in the idea's language, in one or two sentences.",
    "When pass is false, reason says what is missing.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Requirement: ${input.id}`,
    `Pillar: ${input.pillar.name.trim()}`,
    ...(detail ? [`Pillar detail: ${detail}`] : []),
    "",
    "Conceptual idea:",
    input.context.trim(),
    "",
    "What the idea becomes in this pillar:",
    input.development.trim(),
    "",
    `Offered material: ${input.offer.trim() || "(missing)"}`,
    `Comment the viewer must write: ${input.comment.trim() || "(missing)"}`,
    `Withheld trigger: ${input.trigger.trim() || "(missing)"}`,
    "",
    "Claimed reason:",
    input.claim.trim(),
  ].join("\n");
}

function leadMagnetLocalGap(offer: string, comment: string, trigger: string): LeadMagnetPassId | null {
  if (!offer) return "offer";
  if (!comment) return "comment";
  if (!trigger || trigger.toLowerCase() === offer.toLowerCase()) return "trigger";
  return null;
}

function leadMagnetGapChecks(failedId: LeadMagnetPassId): LeadMagnetPassCheck[] {
  const failAt = LEAD_MAGNET_PASS_IDS.indexOf(failedId);
  return LEAD_MAGNET_PASS_IDS.map((id, index) => {
    if (index < failAt) return { id, state: "pass" };
    if (index === failAt) return { id, state: "fail" };
    return { id, state: "pending" };
  });
}

export function parsePillarRecommendationCheck(raw: unknown): { pass: boolean; reason: string } | null {
  const row = asRecord(raw);
  if (!row || typeof row.pass !== "boolean") return null;
  const reason = clip(asText(row.reason), 500);
  if (!reason) return null;
  return { pass: row.pass === true, reason };
}

export async function reviewContentPillars(input: {
  pillars: readonly ReviewablePillar[];
  context: string;
  excludeIds?: readonly string[];
  keep?: number;
  purpose?: PillarReviewPurpose;
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (step: LeadMagnetReviewStep) => void;
  /** A lead-magnet pillar that just cleared every requirement. Called before the next pillar is checked. */
  onPass?: (review: PillarReview) => void;
}): Promise<PillarReview[]> {
  const blocked = new Set(input.excludeIds ?? []);
  const open = input.pillars.filter((pillar) => !blocked.has(pillar.id));
  const { reviewed } = selectPillarReviewSet(open, input.context);
  if (reviewed.length === 0) return [];
  const keep = input.keep ?? 3;
  const purpose = input.purpose ?? "carry";
  const excludedNames = input.pillars.filter((pillar) => blocked.has(pillar.id)).map((pillar) => pillar.name);
  const publish = (step: LeadMagnetReviewStep) => input.onStep?.(step);
  if (purpose === "lead_magnet") {
    publish({ pillarName: "", drafting: true, checks: leadMagnetPassChecklist() });
  }
  const raw = await input.ask(
    buildPillarReviewPrompt({ context: input.context, pillars: reviewed, keep, excludedNames, purpose }),
  );
  const proposed = parsePillarReviews(raw ? parseModelJson(raw) : null, reviewed);
  const confirmed: PillarReview[] = [];
  for (const item of proposed) {
    if (confirmed.length >= keep) break;
    const pillar = reviewed.find((candidate) => candidate.id === item.contentPillarId);
    if (!pillar) continue;
    const offer = purpose === "lead_magnet" ? leadMagnetOffer(item.offer) : "";
    const comment = purpose === "lead_magnet" ? leadMagnetComment(item.comment) : "";
    const trigger = purpose === "lead_magnet" ? leadMagnetTrigger(item.trigger) : "";
    if (purpose === "lead_magnet") {
      const gap = leadMagnetLocalGap(offer, comment, trigger);
      if (gap) {
        publish({ pillarName: pillar.name, drafting: false, checks: leadMagnetGapChecks(gap) });
        continue;
      }
    }
    const development = purpose === "lead_magnet" ? withLeadMagnetExchange(item.development, offer, comment, trigger) : item.development;
    if (purpose === "lead_magnet") {
      const checks = leadMagnetPassChecklist();
      let fitReason = "";
      let failed = false;
      for (const id of LEAD_MAGNET_PASS_IDS) {
        const index = checks.findIndex((check) => check.id === id);
        checks[index] = { id, state: "running" };
        publish({ pillarName: pillar.name, drafting: false, checks: checks.map((check) => ({ ...check })) });
        const checkRaw = await input.ask(
          buildLeadMagnetPassPrompt({
            id,
            context: input.context,
            pillar,
            development,
            claim: item.reason,
            offer,
            comment,
            trigger,
          }),
        );
        const check = parsePillarRecommendationCheck(checkRaw ? parseModelJson(checkRaw) : null);
        if (!check?.pass) {
          checks[index] = { id, state: "fail", ...(check?.reason ? { reason: check.reason } : {}) };
          publish({ pillarName: pillar.name, drafting: false, checks: checks.map((check) => ({ ...check })) });
          failed = true;
          break;
        }
        checks[index] = { id, state: "pass" };
        if (id === "fit") fitReason = check.reason;
        publish({ pillarName: pillar.name, drafting: false, checks: checks.map((check) => ({ ...check })) });
      }
      if (failed || !fitReason) continue;
      const passed: PillarReview = { ...item, development, reason: fitReason, offer, comment, trigger };
      confirmed.push(passed);
      input.onPass?.(passed);
      continue;
    }
    const checkRaw = await input.ask(
      buildPillarRecommendationCheckPrompt({
        context: input.context,
        pillar,
        development,
        claim: item.reason,
        purpose,
        offer,
        comment,
        trigger,
      }),
    );
    const check = parsePillarRecommendationCheck(checkRaw ? parseModelJson(checkRaw) : null);
    if (!check?.pass) continue;
    confirmed.push({
      ...item,
      development,
      reason: check.reason,
      ...(offer ? { offer } : {}),
      ...(comment ? { comment } : {}),
      ...(trigger ? { trigger } : {}),
    });
  }
  return confirmed;
}
