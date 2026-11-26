/**
 * Claim check for briefs (poka-yoke): every factual claim in the voice over, the on-screen text (element) and the
 * caption is looked up in the organization's catalog product fields and Product Knowledge. A claim without a source
 * is a warning, never a block, so a creative line can be written first and its source filled in afterwards.
 */
import type { McpAuthContext } from "../../authz/context";

export type BriefTextPart = { where: string; text: string };

export type ClaimFinding = {
  where: string;
  text: string;
  /** The words that make it a claim, for example "kambing muda" or "2-3 orang". */
  claim: string;
  status: "ada_sumber" | "tanpa_sumber";
  source: string | null;
};

export type ClaimCheck = {
  checked: number;
  without_source: number;
  sources: string[];
  findings: ClaimFinding[];
  note: string | null;
  how_to_read: string;
};

export type ClaimCorpusDeps = {
  listCatalogProducts?: (ctx: McpAuthContext) => Promise<{ products: Array<{ id: string; name: string; aliases: string[] }> }>;
  getCatalogProduct?: (
    ctx: McpAuthContext,
    address: { id?: string; name?: string },
  ) => Promise<{ name: string; aliases: string[]; fields: Array<{ key: string; body: string }> }>;
  listProductKnowledge?: (
    ctx: McpAuthContext,
    input: { serviceId: string | null; subServiceId: string | null; search: string | null; limit: number | null },
  ) => Promise<unknown>;
};

export const CLAIM_CHECK_HOW_TO_READ =
  "claim_check lists the factual claims in the voice over, on-screen text and caption. tanpa_sumber means the claim is not in the catalog product fields or Product Knowledge: " +
  "before the user says yes, show each one as a warning with where it is, then either rewrite it to what the catalog says, drop it, or ask the user whether it is true — " +
  "a fact the user confirms belongs in Product Knowledge (Office) so the next brief passes. This never blocks saving.";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const UNIT =
  "jam|menit|detik|hari|minggu|bulan|tahun|kg|kilo|gram|gr|g|ons|porsi|orang|pax|potong|tusuk|biji|buah|mangkuk|piring|ml|liter|l|%|persen|derajat|x|kali";
const NUMBER_CLAIM = new RegExp(
  `(\\d+(?:[.,]\\d+)?(?:\\s*(?:-|sampai|s/d|hingga)\\s*\\d+(?:[.,]\\d+)?)?)\\s*(${UNIT})(?![a-z])`,
  "gi",
);
const PRICE_CLAIM = /(rp\.?\s*\d[\d.,]*(?:\s*(?:rb|ribu|k)\b)?|\d+(?:[.,]\d+)?\s*(?:rb|ribu|k)\b)/gi;
/** Words that state a fact about the product (quality, origin, process, rank). */
const CLAIM_WORDS = [
  "terenak", "terbaik", "terlaris", "paling", "nomor 1", "no 1", "no. 1", "#1", "satu-satunya", "pertama", "best seller",
  "bestseller", "favorit", "legendaris", "legend", "juara", "asli", "original", "premium", "pilihan", "muda", "segar",
  "fresh", "empuk", "juicy", "halal", "organik", "impor", "import", "lokal", "homemade", "rumahan", "resep rahasia",
  "turun-temurun", "turun temurun", "tanpa msg", "tanpa pengawet", "tanpa bau", "nggak bau", "tidak bau", "tidak amis",
  "nggak amis", "dimasak", "direbus", "dibakar", "dipanggang", "dimarinasi", "diungkep", "diasap", "disangrai", "rempah",
  "habis", "sold out", "laris", "antre", "antri", "viral",
];
/** Calls to action and everyday words that look like claims but are not about the product. */
const NOT_A_CLAIM = /(klik|chat|whatsapp|\bwa\b|pesan duluan|datang|mampir|cobain|yuk|ayo)/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CLAIM_WORD_RE = new RegExp(
  `(?:^|[^a-z0-9])(?:([a-z]+) )?(${CLAIM_WORDS.map(escapeRe).join("|")})(?: ([a-z]+))?(?![a-z])`,
  "gi",
);
/** Claim words that describe the word after them ("paling enak", "tanpa msg" is already whole). */
const FORWARD = new Set(["paling", "satu-satunya", "pertama", "nomor 1", "no 1", "no. 1", "#1", "dimasak", "direbus", "dibakar",
  "dipanggang", "dimarinasi", "diungkep", "diasap", "disangrai", "resep rahasia"]);
const STOP = new Set(["yang", "di", "dan", "ini", "itu", "udah", "sudah", "lebih", "pakai", "pake", "dengan", "nya", "kita", "kami",
  "sangat", "banget", "super", "jadi", "karena", "dari", "ke", "juga", "masih", "tetap", "tetep", "bener", "benar", "emang",
  "memang", "the", "a", "dulu", "lagi", "aja", "saja", "sih", "kok", "dong", "deh", "loh", "nih", "tuh", "biar", "supaya", "untuk",
  "buat", "atau", "tapi", "pasti", "selalu", "semua"]);

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The claims of one sentence (deduplicated), each as the short phrase that carries it. */
export function claimsIn(sentence: string): string[] {
  const s = norm(sentence);
  const out = new Set<string>();
  for (const m of s.matchAll(NUMBER_CLAIM)) out.add(`${m[1]!.replace(/\s+/g, "")} ${m[2]}`);
  for (const m of s.matchAll(PRICE_CLAIM)) out.add(m[1]!.trim());
  for (const m of s.matchAll(CLAIM_WORD_RE)) {
    const [, before, word, after] = m;
    const w = word!.toLowerCase();
    const pair = FORWARD.has(w) ? (after && !STOP.has(after) ? `${w} ${after}` : w) : before && !STOP.has(before) ? `${before} ${w}` : w;
    if (NOT_A_CLAIM.test(pair)) continue;
    out.add(pair);
  }
  return [...out];
}

/** Is the claim written somewhere in the corpus (same phrase, or for a number claim the same numbers and unit)? */
export function supported(claim: string, corpus: string): boolean {
  const c = norm(claim);
  if (corpus.includes(c)) return true;
  const num = /^([\d.,]+)(?:-([\d.,]+))?\s*(\S+)$/.exec(c.replace(/\s*(?:sampai|s\/d|hingga)\s*/, "-"));
  if (num) {
    const [, a, b, unit] = num;
    const re = new RegExp(`${escapeRe(a!)}\\s*(?:-|sampai|s/d|hingga)?\\s*${b ? escapeRe(b) : ""}\\s*${escapeRe(unit!)}`);
    return re.test(corpus);
  }
  // "kambing muda", "paling enak": every word of the claim must be in the corpus as a whole word.
  return c.split(" ").every((w) => new RegExp(`(?:^|[^a-z0-9])${escapeRe(w)}(?![a-z0-9])`).test(corpus));
}

/** Build the searchable text: catalog fields of the products the brief names (or all, up to 6) plus Product Knowledge. */
export async function claimCorpus(
  ctx: McpAuthContext,
  briefText: string,
  deps: ClaimCorpusDeps,
): Promise<{ corpus: string; sources: string[]; note: string | null }> {
  const parts: string[] = [];
  const sources: string[] = [];
  const notes: string[] = [];
  const text = norm(briefText);
  if (deps.listCatalogProducts && deps.getCatalogProduct) {
    try {
      const all = (await deps.listCatalogProducts(ctx)).products;
      const named = all.filter((p) => [p.name, ...(p.aliases ?? [])].some((n) => n && text.includes(norm(n))));
      const pick = (named.length ? named : all).slice(0, 6);
      for (const p of pick) {
        try {
          const full = await deps.getCatalogProduct(ctx, { id: p.id });
          parts.push(norm([full.name, ...(full.aliases ?? []), ...full.fields.map((f) => `${f.key}: ${f.body}`)].join("\n")));
          sources.push(`katalog: ${full.name}`);
        } catch {
          /* one unreadable product only narrows the check */
        }
      }
    } catch {
      notes.push("katalog produk tidak terbaca");
    }
  }
  if (deps.listProductKnowledge) {
    try {
      const rows = await deps.listProductKnowledge(ctx, { serviceId: null, subServiceId: null, search: null, limit: 200 });
      const list = Array.isArray(rows) ? rows : [];
      if (list.length) {
        parts.push(norm(JSON.stringify(list)));
        sources.push(`Product Knowledge (${list.length})`);
      } else {
        notes.push("Product Knowledge kosong");
      }
    } catch (e) {
      notes.push(
        e instanceof Error && e.message === "forbidden"
          ? "Product Knowledge hanya bisa dibaca owner/admin, jadi klaim dicek ke katalog saja"
          : "Product Knowledge tidak terbaca",
      );
    }
  }
  return { corpus: parts.join("\n"), sources, note: notes.length ? notes.join("; ") : null };
}

export async function checkBriefClaims(
  ctx: McpAuthContext,
  parts: BriefTextPart[],
  deps: ClaimCorpusDeps,
): Promise<ClaimCheck> {
  const { corpus, sources, note } = await claimCorpus(ctx, parts.map((p) => p.text).join("\n"), deps);
  const findings: ClaimFinding[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    for (const sentence of sentences(part.text)) {
      for (const claim of claimsIn(sentence)) {
        const key = `${part.where}|${claim}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ok = corpus.length > 0 && supported(claim, corpus);
        findings.push({
          where: part.where,
          text: sentence,
          claim,
          status: ok ? "ada_sumber" : "tanpa_sumber",
          source: ok ? sources.join(", ") : null,
        });
      }
    }
  }
  return {
    checked: findings.length,
    without_source: findings.filter((f) => f.status === "tanpa_sumber").length,
    sources,
    findings: findings.sort((a, b) => (a.status === b.status ? 0 : a.status === "tanpa_sumber" ? -1 : 1)),
    note,
    how_to_read: CLAIM_CHECK_HOW_TO_READ,
  };
}

/** Text parts of a brief write: each storyboard row's vo and element, the voice over and the caption. */
export function briefTextParts(input: {
  rows?: Array<{ vo?: string | null; element?: string | null; label?: string }>;
  voiceOver?: string | null;
  caption?: string | null;
}): BriefTextPart[] {
  const out: BriefTextPart[] = [];
  (input.rows ?? []).forEach((r, i) => {
    const label = r.label ?? `baris ${i + 1}`;
    if (r.vo?.trim()) out.push({ where: `${label} VO`, text: r.vo });
    if (r.element?.trim()) out.push({ where: `${label} teks layar`, text: r.element });
  });
  if (input.voiceOver?.trim()) out.push({ where: "voice over", text: input.voiceOver });
  if (input.caption?.trim()) out.push({ where: "caption", text: input.caption });
  return out;
}
