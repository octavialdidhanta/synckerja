// Master Thought: the pass checks, the belief options from "Bantu rumuskan", and the stored facts.
// Every belief that is saved, typed or picked, goes through the same switched-on checks.
// Relative imports only: the MCP server loads this file.
import { parseModelJson } from "../shared/parseModelJson";
import { fingerprintsMatch, masterThoughtFingerprint } from "../shared/fingerprint";
import type { BeliefOption, MasterCatalogContext, MasterThoughtFacts } from "./types";

export function beliefsMatch(left: string, right: string): boolean {
  const normalized = (value: string) => value.replace(/\s+/g, " ").trim();
  const a = normalized(left);
  const b = normalized(right);
  return a.length > 0 && a === b;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordOf(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function withCapital(text: string): string {
  const characters = Array.from(text);
  const index = characters.findIndex((character) => /\p{L}/u.test(character));
  if (index < 0) return text;
  characters[index] = characters[index].toLocaleUpperCase();
  return characters.join("");
}

const LEADING_TERNYATA = /^\s*ternyata\b[\s,:]*/i;

/** The claim without a leading Ternyata, used to compare beliefs. */
export function beliefClaim(value: string): string {
  return value.replace(LEADING_TERNYATA, "").replace(/\s+/g, " ").trim();
}

function sameClaim(left: string, right: string): boolean {
  const claim = (value: string) => beliefClaim(value).toLocaleLowerCase();
  return beliefsMatch(claim(left), claim(right));
}

function readBeliefOption(item: unknown): BeliefOption | null {
  if (typeof item === "string") {
    const belief = item.replace(/\s+/g, " ").trim();
    return belief ? { belief, description: "" } : null;
  }
  const row = recordOf(item);
  if (!row) return null;
  const belief = asText(row.belief ?? row.text).replace(/\s+/g, " ").trim();
  if (!belief) return null;
  return { belief, description: asText(row.description ?? row.note).replace(/\s+/g, " ").trim() };
}

// ---------------------------------------------------------------------------------------------------
// Stored facts

/** Facts saved with a belief: the belief is its own subject. */
export function confirmedBeliefFacts(belief: string): MasterThoughtFacts {
  return { subject: withCapital(belief.replace(/\s+/g, " ").trim()), beliefOptions: [] };
}

/** Reads stored facts, older rows included: only the subject and the waiting belief options are kept. */
export function normalizeMasterThoughtFacts(raw: unknown): MasterThoughtFacts | null {
  const row = recordOf(raw);
  if (!row) return null;
  const subject = asText(row.subject).replace(/\s+/g, " ");
  const options = Array.isArray(row.beliefOptions)
    ? row.beliefOptions.flatMap((item) => {
        const option = readBeliefOption(item);
        return option ? [option] : [];
      })
    : [];
  return { subject: subject ? withCapital(subject) : null, beliefOptions: options.slice(0, 3) };
}

export function confirmedFingerprint(statement: string, rootBelief: string): string {
  return masterThoughtFingerprint({ statement, rootBelief });
}

/** A saved belief whose fingerprint still matches its sentence. */
export function confirmedParentReady(input: {
  confirmationSource: string | null;
  statement: string;
  rootBelief: string;
  semanticFingerprint: string | null;
}): boolean {
  if (!input.confirmationSource || !input.statement.trim()) return false;
  return fingerprintsMatch(
    input.semanticFingerprint,
    confirmedFingerprint(input.statement, input.rootBelief || input.statement),
  );
}

// ---------------------------------------------------------------------------------------------------
// Pass checks

/** The pass checks of a Master Thought, in the order they are judged. */
export const MASTER_CHECK_IDS = ["singleClaim", "noPromoOrBrand", "subjectClear", "shift", "accountable"] as const;

export type MasterCheckId = (typeof MASTER_CHECK_IDS)[number];

/** The exact rule of every Master Thought check. The model judges with these words and the page shows them. */
export const MASTER_CHECK_RULES: Readonly<Record<MasterCheckId, string>> = {
  singleClaim:
    "Lolos hanya jika berupa satu kalimat dengan tepat satu klaim, yang tetap terbaca utuh saat ditambah koma dan \"karena\" di belakangnya. Gagal jika ada dua keyakinan terpisah yang digabung dengan \"dan\", atau berisi beberapa kalimat, pertanyaan, atau seruan.",
  noPromoOrBrand:
    "Gagal jika kalimat menyebut nama merek, toko, atau penyedia, atau memuat unsur promosi: penawaran, garansi, harga, diskon, tantangan ke pembaca, ajakan beli atau coba, atau tagline. Tetap gagal walaupun klaimnya bagus. Nama berarti nama diri yang tertulis, misalnya nama warung atau nama produk. Kata penunjuk seperti \"di sini\", \"disini\", \"ini\", \"kami\", atau \"kita\" bukan nama, jadi jangan gagalkan karena kata itu.",
  subjectClear:
    "Lolos hanya jika ada satu subjek jelas yang nanti bisa ditunjukkan sebagai penyebab di Idea. Jika sub-kategori atau fitur dipilih, subjek harus dimiliki salah satunya. Jika hanya kategori yang dipilih, subjek cukup masuk akal dimiliki produk atau layanan di kategori itu. Gagal jika subjeknya kabur, lebih dari satu, atau jelas tidak dimiliki produk atau layanan tersebut.",
  shift: "Lolos hanya jika kalimat menggeser keyakinan lama. Gagal jika hanya menyalin atau mengulang keyakinan lama.",
  accountable:
    "Lolos jika klaim masuk akal dan bisa didukung alasan atau bukti wajar. Gagal jika klaimnya menyesatkan, mutlak tanpa dasar (misalnya \"100%\" atau \"pasti sembuh\"), atau berbahaya bila dipercaya.",
};

export type WrittenBeliefCheck = { pass: boolean; reasons: string[] };

export type WrittenBeliefInput = {
  belief: string;
  priorBelief: string;
  catalog: MasterCatalogContext | null;
};

function catalogLines(catalog: MasterCatalogContext | null): string[] {
  if (!catalog) return [];
  return [
    "",
    "Kategori:",
    catalog.category,
    ...(catalog.subCategories.length ? ["", "Sub-kategori yang dipilih:", ...catalog.subCategories] : []),
    ...(catalog.features.length ? ["", "Fitur yang dipilih:", ...catalog.features] : []),
  ];
}

export function buildWrittenBeliefCheckPrompt(
  input: WrittenBeliefInput,
  ids: readonly MasterCheckId[] = MASTER_CHECK_IDS,
): string {
  return [
    "Judge this Master Thought. Do not rewrite it.",
    ...ids.map((id) => `${id}: ${MASTER_CHECK_RULES[id]}`),
    "Judge only the words written under Belief. The old belief and the category lines are context: a name that appears only there is not in the belief and never fails noPromoOrBrand.",
    "Write each reason in the same language as the belief, in one short sentence a user can act on. Name the words that fail, in quotes.",
    `Return JSON only: {"checks":[{"id":"${ids[0] ?? MASTER_CHECK_IDS[0]}","pass":true,"reason":""}]}`,
    "Include one entry for each check id named above.",
    "",
    "Belief:",
    input.belief.trim(),
    "",
    "Old belief:",
    input.priorBelief.trim(),
    ...catalogLines(input.catalog),
  ].join("\n");
}

function folded(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/** Words the reason quotes ('…', "…", “…”, ‘…’). */
function quotedWords(reason: string): string[] {
  return [...reason.matchAll(/['"“‘]([^'"”’]{2,80})['"”’]/g)].map((match) => match[1].trim()).filter(Boolean);
}

/**
 * A brand fail that only quotes names the belief does not contain is the model reading the category or
 * another line of the prompt as the belief, so it does not count.
 */
function brandFailIsMisread(reason: string, belief: string): boolean {
  const quoted = quotedWords(reason);
  if (quoted.length === 0) return false;
  const text = folded(belief);
  return quoted.every((word) => !text.includes(folded(word)));
}

export function parseWrittenBeliefCheck(
  raw: unknown,
  ids: readonly string[],
  belief?: string,
): WrittenBeliefCheck | null {
  const row = recordOf(raw);
  const list = Array.isArray(row?.checks) ? row.checks : null;
  if (!list) return null;
  const reasons: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const entry = recordOf(item);
    const id = typeof entry?.id === "string" ? entry.id : "";
    if (!entry || !ids.includes(id)) continue;
    seen.add(id);
    if (entry.pass === true) continue;
    const reason = typeof entry.reason === "string" ? entry.reason.trim() : "";
    if (id === "noPromoOrBrand" && belief && brandFailIsMisread(reason, belief)) continue;
    reasons.push(reason || id);
  }
  if (ids.some((id) => !seen.has(id))) return null;
  return { pass: reasons.length === 0, reasons };
}

/**
 * A category and an old belief are required before a belief is saved. Two tries; an answer that cannot be
 * read counts as not passed, so no belief skips a switched-on check.
 */
export async function checkWrittenBelief(
  input: WrittenBeliefInput & { skip?: readonly string[] },
  ask: (prompt: string) => Promise<string | null>,
): Promise<WrittenBeliefCheck> {
  if (!input.catalog?.category.trim()) return { pass: false, reasons: ["CATALOG_REQUIRED"] };
  if (!input.priorBelief.trim()) return { pass: false, reasons: ["PRIOR_REQUIRED"] };
  if (sameClaim(input.belief, input.priorBelief)) return { pass: false, reasons: ["SAME_BELIEF"] };
  const ids = MASTER_CHECK_IDS.filter((id) => !input.skip?.includes(id));
  if (ids.length === 0) return { pass: true, reasons: [] };
  const prompt = buildWrittenBeliefCheckPrompt(input, ids);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = parseWrittenBeliefCheck(parseModelJson(await ask(prompt)), ids, input.belief);
    if (parsed) return parsed;
  }
  return { pass: false, reasons: ["UNDECIDED"] };
}

// ---------------------------------------------------------------------------------------------------
// "Bantu rumuskan": three belief options

function startsWithBecause(value: string): boolean {
  return /^(karena|because)\b/i.test(value.trim());
}

function soundsLikeTitle(value: string): boolean {
  return /^(?:kemampuan|kemungkinan|pentingnya|adanya|the ability|the possibility|the importance)\b/i.test(value.trim());
}

/** Drop empty lines, reasons, titles, the old belief, and duplicates. A leading Ternyata is ignored. */
export function filterBeliefCandidates(candidates: Array<string | BeliefOption>, priorBelief = ""): BeliefOption[] {
  const seen = new Set<string>();
  const kept: BeliefOption[] = [];
  for (const raw of candidates) {
    const option = readBeliefOption(raw);
    if (!option) continue;
    const choice = option.belief;
    const claim = beliefClaim(choice);
    if (!claim) continue;
    if (startsWithBecause(choice) || startsWithBecause(claim)) continue;
    if (soundsLikeTitle(claim) || soundsLikeTitle(choice)) continue;
    if (priorBelief.trim() && sameClaim(choice, priorBelief)) continue;
    const key = claim.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ belief: withCapital(choice), description: option.description });
  }
  return kept;
}

export function buildBeliefOptionsPrompt(input: {
  planted: string;
  priorBelief: string;
  audience?: string;
  catalog: MasterCatalogContext | null;
}): string {
  const audience = input.audience?.trim() ?? "";
  return [
    "Write three beliefs the user can plant as a Master Thought.",
    "Every belief must meet each of these rules:",
    ...MASTER_CHECK_IDS.map((id) => MASTER_CHECK_RULES[id]),
    "Keep only the belief when the new belief also carries a promotion. Do not carry the promotion into any belief.",
    "Length may be short or detailed. Do not prefer a shorter sentence.",
    "Do not start a belief with karena or because.",
    "Start a belief with Ternyata only when that belief shifts the old belief. Ternyata is optional.",
    "Stay inside the shift between the old belief and the new belief.",
    "Do not add a topic, benefit, feeling, or situation that neither of those sentences carries.",
    "Each description says what this belief asks someone to hold, and how it shifts the old belief, in two or three sentences.",
    "Write every belief and description in the same language as the new belief.",
    "Do not use examples from any specific industry, belief system, or brand.",
    'Return JSON only: {"beliefs":[{"belief":"","description":""}]}',
    "",
    "New belief:",
    input.planted.trim(),
    "",
    "Old belief:",
    input.priorBelief.trim(),
    ...(audience
      ? ["", "The audience is only who is addressed. Do not replace the claim with the audience.", "Audience:", audience]
      : []),
    ...catalogLines(input.catalog),
  ].join("\n");
}

export function parseBeliefDrafts(raw: unknown): BeliefOption[] {
  const row = recordOf(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(row?.beliefs) ? row.beliefs : [];
  return list.flatMap((item) => {
    const option = readBeliefOption(item);
    return option ? [option] : [];
  }).slice(0, 3);
}

/** Three drafts, then only the ones that pass the same switched-on checks as a typed belief. */
export async function collectBeliefOptions(
  input: {
    planted: string;
    priorBelief: string;
    audience?: string;
    catalog: MasterCatalogContext | null;
    skip?: readonly string[];
  },
  ask: (prompt: string) => Promise<string | null>,
  judge: (prompt: string) => Promise<string | null> = ask,
): Promise<BeliefOption[]> {
  const planted = input.planted.trim();
  if (!planted) return [];
  const drafted = parseBeliefDrafts(parseModelJson(await ask(buildBeliefOptionsPrompt({ ...input, planted }))));
  const candidates = filterBeliefCandidates(drafted, input.priorBelief).filter((option) => !sameClaim(option.belief, planted));
  const checks = await Promise.all(
    candidates.map((option) =>
      checkWrittenBelief(
        { belief: option.belief, priorBelief: input.priorBelief, catalog: input.catalog, skip: input.skip },
        judge,
      ),
    ),
  );
  return candidates.filter((_, index) => checks[index]?.pass);
}
