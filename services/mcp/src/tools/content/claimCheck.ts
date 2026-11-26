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
  industry: string | null;
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
  /** The organization's industry template and its claim words. */
  getClaimWords?: (ctx: McpAuthContext) => Promise<{ industry: string | null; claim_words: string[] }>;
  /** Gaya baku boxes; "Kata klaim: ..." lines add the organization's own words. */
  getCatalogStyle?: (ctx: McpAuthContext) => Promise<Record<string, string | null | undefined>>;
  listProductKnowledge?: (
    ctx: McpAuthContext,
    input: { serviceId: string | null; subServiceId: string | null; search: string | null; limit: number | null },
  ) => Promise<unknown>;
};

export const CLAIM_CHECK_HOW_TO_READ =
  "claim_check lists the factual claims it can spot by pattern (numbers with a unit, prices, rank and guarantee words, the organization's industry and Gaya baku claim words). " +
  "It matches words, not meaning: read the brief yourself as a second layer and treat any other factual statement the same way (check it with catalog.product.get / product_knowledge.list). " +
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
  "jam|menit|detik|hari|minggu|bulan|tahun|kg|kilo|gram|gr|ons|porsi|orang|pax|potong|tusuk|biji|buah|pcs|unit|mangkuk|piring|ml|liter|%|persen|derajat|x|kali|mah|watt|gb|tb|inch|inci|hz|m2|meter|km|cm|mm|lantai|kamar|sesi|treatment|pengguna|user|pelanggan|customer";
const NUMBER_CLAIM = new RegExp(
  `(\\d+(?:[.,]\\d+)?(?:\\s*(?:-|sampai|s/d|hingga)\\s*\\d+(?:[.,]\\d+)?)?)\\s*(${UNIT})(?![a-z])`,
  "gi",
);
const PRICE_CLAIM = /(rp\.?\s*\d[\d.,]*(?:\s*(?:rb|ribu|k|jt|juta)\b)?|\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta)\b)/gi;

/**
 * Universal claim words: rank, superlative and guarantee language that states a fact in any industry.
 * Industry words come from the organization's catalog industry template, extra words from Gaya baku ("Kata klaim: ...").
 */
export const UNIVERSAL_CLAIM_WORDS = [
  "paling", "nomor 1", "no 1", "no. 1", "#1", "satu-satunya", "pertama", "best seller", "bestseller", "terlaris",
  "terbaik", "termurah", "tercepat", "terlengkap", "terpercaya", "teraman", "terawet", "terkuat", "terbesar", "terenak",
  "termewah", "terbaru", "terpopuler", "terdekat", "terhemat", "terfavorit", "favorit", "legendaris", "juara", "rating",
  "bintang 5", "dijamin", "jaminan", "garansi", "terbukti", "pasti", "permanen", "selamanya", "tanpa efek samping",
  "aman", "asli", "original", "resmi", "bersertifikat", "sertifikat", "halal", "sni", "izin", "premium", "berkualitas",
  "kualitas", "gratis",
];

/** Calls to action and everyday words that look like claims but are not about the product. */
const NOT_A_CLAIM = /(klik|chat|whatsapp|\bwa\b|pesan duluan|datang|mampir|cobain|yuk|ayo)/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Claim words that describe the word after them ("paling enak"); the others take the word before ("kambing muda"). */
const FORWARD = new Set(["paling", "satu-satunya", "pertama", "nomor 1", "no 1", "no. 1", "#1", "dijamin", "garansi",
  "jaminan", "terbukti", "dimasak", "direbus", "dibakar", "dipanggang", "dimarinasi", "diungkep", "diasap", "disangrai",
  "resep rahasia", "menghilangkan", "memutihkan", "mencerahkan", "dekat"]);
const STOP = new Set(["yang", "di", "dan", "ini", "itu", "udah", "sudah", "lebih", "pakai", "pake", "dengan", "nya", "kita", "kami",
  "sangat", "banget", "super", "jadi", "karena", "dari", "ke", "juga", "masih", "tetap", "tetep", "bener", "benar", "emang",
  "memang", "the", "a", "dulu", "lagi", "aja", "saja", "sih", "kok", "dong", "deh", "loh", "nih", "tuh", "biar", "supaya", "untuk",
  "buat", "atau", "tapi", "pasti", "selalu", "semua", "bisa", "dapat", "akan", "cuma", "hanya", "lho"]);

/** Claim-word matcher for one organization: universal + industry + Gaya baku words, longest first. */
export function claimWordMatcher(extra: string[] = []): RegExp {
  const words = [...new Set([...UNIVERSAL_CLAIM_WORDS, ...extra].map((w) => norm(w)).filter((w) => w.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  return new RegExp(`(?:^|[^a-z0-9])(?:([a-z]+) )?(${words.map(escapeRe).join("|")})(?: ([a-z]+))?(?![a-z0-9])`, "gi");
}

/** "Kata klaim: a, b, c" lines in any Gaya baku box (an organization's own claim words). */
export function gayaClaimWords(blocks: Record<string, string | null | undefined> | null | undefined): string[] {
  const out: string[] = [];
  for (const text of Object.values(blocks ?? {})) {
    for (const line of String(text ?? "").split("\n")) {
      const m = /kata\s+klaim\s*[:=-]\s*(.+)$/i.exec(line);
      if (m) out.push(...m[1]!.split(/[,;]/).map((w) => w.trim().replace(/^["'“”]+|["'“”.]+$/g, "")).filter(Boolean));
    }
  }
  return out;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The claims of one sentence (deduplicated), each as the short phrase that carries it. */
export function claimsIn(sentence: string, matcher: RegExp = claimWordMatcher()): string[] {
  const s = norm(sentence);
  const out = new Set<string>();
  for (const m of s.matchAll(NUMBER_CLAIM)) out.add(`${m[1]!.replace(/\s+/g, "")} ${m[2]}`);
  for (const m of s.matchAll(PRICE_CLAIM)) out.add(m[1]!.trim());
  for (const m of s.matchAll(new RegExp(matcher.source, "gi"))) {
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
  let industry: string | null = null;
  const extra: string[] = [];
  if (deps.getClaimWords) {
    try {
      const got = await deps.getClaimWords(ctx);
      industry = got.industry;
      extra.push(...(got.claim_words ?? []));
    } catch {
      /* universal patterns still run */
    }
  }
  if (deps.getCatalogStyle) {
    try {
      extra.push(...gayaClaimWords(await deps.getCatalogStyle(ctx)));
    } catch {
      /* no Gaya baku words */
    }
  }
  const matcher = claimWordMatcher(extra);
  const findings: ClaimFinding[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    for (const sentence of sentences(part.text)) {
      for (const claim of claimsIn(sentence, matcher)) {
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
    industry,
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
