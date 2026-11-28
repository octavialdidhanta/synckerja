/**
 * Claim check (poka-yoke): every factual claim in the voice over, the on-screen text (element), the caption, a render's
 * screen text or a shot prompt is looked up first in the Daftar Klaim (product_claims), then in the catalog product
 * fields and Product Knowledge. Only an approved claim in the Daftar Klaim counts as proven. Anything else is a
 * warning, never a block, so a creative line can be written first and its proof filled in afterwards.
 */
import type { McpAuthContext } from "../../authz/context";
import {
  claimWordMatcher,
  claimsIn,
  gayaClaimWords,
  matchRegistry,
  norm,
  scopeLabel,
  sentences,
  supported,
  visualClaimsIn,
  type RegistryClaim,
} from "../../../../../src/shared/claims/claimMatch";

export {
  claimScopeFits,
  claimWordMatcher,
  claimsIn,
  gayaClaimWords,
  matchRegistry,
  supported,
  UNIVERSAL_CLAIM_WORDS,
  visualClaimsIn,
  type RegistryClaim,
} from "../../../../../src/shared/claims/claimMatch";

/** visual: the text describes what is seen (a shot prompt, often in English), checked with visualClaimsIn. */
export type BriefTextPart = { where: string; text: string; visual?: boolean };

/**
 * terdaftar: an approved claim in the Daftar Klaim backs it (code KLnn).
 * perlu_bukti: the Daftar Klaim has it, but it is not approved yet.
 * ditolak: the Daftar Klaim has it as rejected: do not state it.
 * sumber_katalog: not in the Daftar Klaim, but the catalog or Product Knowledge says it (offer to add it).
 * tidak_terdaftar: no source anywhere.
 */
export type ClaimStatus = "terdaftar" | "perlu_bukti" | "ditolak" | "sumber_katalog" | "tidak_terdaftar";

export type ClaimFinding = {
  where: string;
  text: string;
  /** The words that make it a claim, for example "kambing muda" or "2-3 orang". */
  claim: string;
  status: ClaimStatus;
  /** Daftar Klaim code (KL01...) when the registry has it. */
  code: string | null;
  source: string | null;
  /** A registry claim that says it but applies to another product or location. */
  other_scope?: string;
};

export type ClaimCheck = {
  industry: string | null;
  checked: number;
  /** Findings that are not backed by an approved claim. */
  needs_attention: number;
  /** tidak_terdaftar + ditolak: nothing allows stating these. */
  without_source: number;
  /** Codes of the Daftar Klaim claims this text uses (approved or waiting for proof). */
  codes_used: string[];
  sources: string[];
  findings: ClaimFinding[];
  note: string | null;
  how_to_read: string;
};


export type ClaimCorpusDeps = {
  /** The Daftar Klaim: the primary source. */
  listCatalogClaims?: (ctx: McpAuthContext) => Promise<{ claims: RegistryClaim[] }>;
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
  "claim_check lists the factual claims it can spot by pattern (numbers with a unit, prices, rank and guarantee words, the organization's industry and Gaya baku claim words) " +
  "and looks each one up in the Daftar Klaim first (catalog.claims.list), then in the catalog and Product Knowledge. It matches words, not meaning: read the text yourself as a second layer " +
  "and treat any other factual statement the same way. Status: terdaftar = an approved claim (code) backs it, fine to state; perlu_bukti = registered but not approved yet; " +
  "ditolak = the owner rejected it, remove it; sumber_katalog = the catalog or Product Knowledge says it but it is not in the Daftar Klaim; tidak_terdaftar = no source. " +
  "Before the user says yes, show every finding that is not terdaftar as a warning with where it is, then rewrite it to an approved claim, drop it, or ask the user whether it is true. " +
  "A fact the user confirms goes to the Daftar Klaim with catalog.claims.upsert.preview (it starts as needs_proof until an owner or admin approves it), not to Product Knowledge. " +
  "other_scope means a claim with those words exists for another product or location. This never blocks saving.";

/** Build the searchable text: catalog fields of the products the brief names (or all, up to 6) plus Product Knowledge. */
export async function claimCorpus(
  ctx: McpAuthContext,
  briefText: string,
  deps: ClaimCorpusDeps,
): Promise<{ corpus: string; sources: string[]; note: string | null; named: string[] }> {
  const parts: string[] = [];
  let namedIds: string[] = [];
  const sources: string[] = [];
  const notes: string[] = [];
  const text = norm(briefText);
  if (deps.listCatalogProducts && deps.getCatalogProduct) {
    try {
      const all = (await deps.listCatalogProducts(ctx)).products;
      const named = all.filter((p) => [p.name, ...(p.aliases ?? [])].some((n) => n && text.includes(norm(n))));
      namedIds = named.map((p) => p.id);
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
  return { corpus: parts.join("\n"), sources, note: notes.length ? notes.join("; ") : null, named: namedIds };
}

export async function checkBriefClaims(
  ctx: McpAuthContext,
  parts: BriefTextPart[],
  deps: ClaimCorpusDeps,
): Promise<ClaimCheck> {
  const { corpus, sources: corpusSources, note: corpusNote, named } = await claimCorpus(ctx, parts.map((p) => p.text).join("\n"), deps);
  const notes = corpusNote ? [corpusNote] : [];
  let registry: RegistryClaim[] = [];
  if (deps.listCatalogClaims) {
    try {
      registry = (await deps.listCatalogClaims(ctx)).claims ?? [];
    } catch {
      notes.push("Daftar Klaim tidak terbaca, klaim dicek ke katalog dan Product Knowledge saja");
    }
  }
  const sources = [...(deps.listCatalogClaims ? [`Daftar Klaim (${registry.length})`] : []), ...corpusSources];
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
    for (const sentence of part.visual ? [part.text.trim()] : sentences(part.text)) {
      for (const claim of part.visual ? visualClaimsIn(sentence) : claimsIn(sentence, matcher)) {
        const key = `${part.where}|${claim}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { hit, otherScope } = matchRegistry(claim, registry, named);
        if (hit) {
          findings.push({
            where: part.where,
            text: sentence,
            claim,
            status: hit.status === "approved" ? "terdaftar" : hit.status === "needs_proof" ? "perlu_bukti" : "ditolak",
            code: hit.code,
            source: `Daftar Klaim ${hit.code}: ${hit.text}`,
          });
          continue;
        }
        const inCatalog = corpus.length > 0 && supported(claim, corpus);
        findings.push({
          where: part.where,
          text: sentence,
          claim,
          status: inCatalog ? "sumber_katalog" : "tidak_terdaftar",
          code: null,
          source: inCatalog ? corpusSources.join(", ") : null,
          ...(otherScope ? { other_scope: `${otherScope.code} (${scopeLabel(otherScope)}): ${otherScope.text}` } : {}),
        });
      }
    }
  }
  const order: Record<ClaimStatus, number> = { ditolak: 0, tidak_terdaftar: 1, perlu_bukti: 2, sumber_katalog: 3, terdaftar: 4 };
  return {
    industry,
    checked: findings.length,
    needs_attention: findings.filter((f) => f.status !== "terdaftar").length,
    without_source: findings.filter((f) => f.status === "tidak_terdaftar" || f.status === "ditolak").length,
    codes_used: [...new Set(findings.filter((f) => f.status === "terdaftar" || f.status === "perlu_bukti").map((f) => f.code!))].sort(),
    sources,
    findings: findings.sort((a, b) => order[a.status] - order[b.status]),
    note: notes.length ? notes.join("; ") : null,
    how_to_read: CLAIM_CHECK_HOW_TO_READ,
  };
}

/** Shot list shots as visual parts: what each shot shows (action, judul, menu, lokasi). */
export function shotlistVisualParts(shots: unknown): BriefTextPart[] {
  if (!Array.isArray(shots)) return [];
  return shots.flatMap((shot, i) => {
    const s = (shot ?? {}) as Record<string, unknown>;
    const text = ["judul", "action", "menu", "lokasi", "area"]
      .map((k) => (typeof s[k] === "string" ? (s[k] as string) : ""))
      .filter(Boolean)
      .join(" | ");
    if (!text) return [];
    return [{ where: `shot ${typeof s.id === "string" ? s.id : i + 1} (visual)`, text, visual: true }];
  });
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
