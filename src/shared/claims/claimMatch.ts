/**
 * Claim matching shared by the MCP claim_check and Office (scheduled posts): spot claim phrases in text,
 * and look them up in the Daftar Klaim and a source text. Pure functions, no I/O.
 */

export type RegistryClaim = {
  code: string;
  text: string;
  status: "needs_proof" | "approved" | "rejected";
  scopes: Array<{ scope: "brand" | "product" | "location"; product?: string; location?: string; product_name?: string; location_name?: string }>;
};

/**
 * Everyday spellings mapped to the standard word, so "nggak bau prengus" in a script matches the approved claim
 * "tidak bau prengus". The AI and the team can write casually; the check compares meaning words, not spelling.
 */
export const INFORMAL_WORDS: Record<string, string> = {
  nggak: "tidak", ngga: "tidak", ngak: "tidak", gak: "tidak", ga: "tidak", enggak: "tidak", engga: "tidak",
  gk: "tidak", tdk: "tidak", tak: "tidak", kagak: "tidak", ndak: "tidak",
  udah: "sudah", udh: "sudah", sdh: "sudah", dah: "sudah",
  banget: "sangat", bgt: "sangat",
  aja: "saja", doang: "saja",
  pake: "pakai", emang: "memang", bener: "benar", beneran: "benar", tetep: "tetap",
  gede: "besar", dikit: "sedikit", sampe: "sampai", nyampe: "sampai",
  bikin: "membuat", kalo: "kalau", gini: "begini", gitu: "begitu",
  yg: "yang", dgn: "dengan", utk: "untuk", krn: "karena", org: "orang", jg: "juga", blm: "belum", belom: "belum",
};

const INFORMAL_RE = new RegExp(`(^|[^a-z0-9])(${Object.keys(INFORMAL_WORDS).sort((a, b) => b.length - a.length).join("|")})(?![a-z0-9])`, "g");

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(INFORMAL_RE, (_m, pre: string, word: string) => `${pre}${INFORMAL_WORDS[word]}`);

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
const NOT_A_CLAIM = /(klik|chat|whatsapp|\bwa\b|pesan duluan|datang|mampir|cobain|yuk|ayo|suara asli)/i;

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

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The claims of one sentence (deduplicated), each as the short phrase that carries it. */
export function claimsIn(sentence: string, matcher: RegExp = claimWordMatcher()): string[] {
  // Stage notes in brackets ("(suara asli)", "[musik masuk]") are directions for the editor, not words on screen.
  const s = norm(sentence.replace(/\([^)]*\)|\[[^\]]*\]/g, " "));
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

/**
 * Things a picture can claim: a halal logo, a certificate, a queue, a best seller sign, an award. Prompts are often
 * English, so each pattern maps to the Indonesian word the Daftar Klaim and catalog use.
 */
const VISUAL_CLAIMS: Array<[RegExp, string]> = [
  [/\bhalal\b/i, "halal"],
  [/\b(certificate|certified|sertifikat|bersertifikat)\b/i, "sertifikat"],
  [/\b(bpom)\b/i, "bpom"],
  [/\b(sni)\b/i, "sni"],
  [/\b(long )?(queue|line of (people|customers)|antre(an)?|antri(an)?)\b/i, "antre"],
  [/\b(best ?seller|terlaris)\b/i, "best seller"],
  [/\b(award|trophy|piala|penghargaan|juara)\b/i, "juara"],
  [/\b(number one|no\.? ?1|#1|nomor 1)\b/i, "nomor 1"],
  [/\b(michelin)\b/i, "michelin"],
  [/\b(5|five)[- ]stars?\b|\brating\b/i, "rating"],
  [/\b(sold out|habis)\b/i, "habis"],
  [/\b(viral)\b/i, "viral"],
  [/\b(crowded|packed with (people|customers)|ramai)\b/i, "ramai"],
  [/\b(original|asli|authentic)\b/i, "asli"],
  [/\b(free|gratis)\b/i, "gratis"],
];

/** Visual claims in a shot prompt, as the Indonesian word to look up. */
export function visualClaimsIn(text: string): string[] {
  return [...new Set(VISUAL_CLAIMS.filter(([re]) => re.test(text)).map(([, word]) => word))];
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
  // "dagingnya" counts as "daging": the -nya/-ku/-mu suffix does not change the fact.
  const has = (w: string) => new RegExp(`(?:^|[^a-z0-9])${escapeRe(w)}(?:nya|ku|mu)?(?![a-z0-9])`).test(corpus);
  return c.split(" ").every((w) => has(w) || (/(nya|ku|mu)$/.test(w) && w.length > 5 && has(w.replace(/(nya|ku|mu)$/, ""))));
}


const STATUS_RANK: Record<RegistryClaim["status"], number> = { approved: 0, needs_proof: 1, rejected: 2 };

/** A registry claim fits the text when it is brand-wide, about a location, or about a product the text names (or names none). */
export function claimScopeFits(claim: RegistryClaim, namedProducts: string[]): boolean {
  if (!claim.scopes.length) return true;
  return claim.scopes.some(
    (s) => s.scope === "brand" || s.scope === "location" || !namedProducts.length || (s.product ? namedProducts.includes(s.product) : false),
  );
}

export function scopeLabel(claim: RegistryClaim): string {
  return claim.scopes.map((s) => s.product_name ?? s.location_name ?? s.product ?? s.location ?? s.scope).join(", ");
}

/** The best registry claim for a claim phrase: one whose sentence contains it, in scope, approved first. */
export function matchRegistry(
  phrase: string,
  registry: RegistryClaim[],
  namedProducts: string[],
): { hit: RegistryClaim | null; otherScope: RegistryClaim | null } {
  const found = registry
    .filter((c) => supported(phrase, norm(c.text)))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.code.localeCompare(b.code));
  const hit = found.find((c) => claimScopeFits(c, namedProducts)) ?? null;
  return { hit, otherScope: hit ? null : (found[0] ?? null) };
}

