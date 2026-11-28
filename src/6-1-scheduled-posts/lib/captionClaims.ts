/**
 * Last guard before a post goes live: the factual claims in a caption, looked up in the Daftar Klaim.
 * Same matching as the MCP claim_check (src/shared/claims/claimMatch). A warning, never a block.
 */
import {
  claimWordMatcher,
  claimsIn,
  gayaClaimWords,
  matchRegistry,
  sentences,
  type RegistryClaim,
} from "@/shared/claims/claimMatch";

export type CaptionClaimStatus = "terdaftar" | "perlu_bukti" | "ditolak" | "tidak_terdaftar";

export interface CaptionClaimFinding {
  claim: string;
  sentence: string;
  status: CaptionClaimStatus;
  code: string | null;
}

export function checkCaptionClaims(
  caption: string,
  registry: RegistryClaim[],
  extraWords: string[] = [],
): CaptionClaimFinding[] {
  const matcher = claimWordMatcher(extraWords);
  const out: CaptionClaimFinding[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences(caption)) {
    for (const claim of claimsIn(sentence, matcher)) {
      if (seen.has(claim)) continue;
      seen.add(claim);
      const { hit } = matchRegistry(claim, registry, []);
      out.push({
        claim,
        sentence,
        code: hit?.code ?? null,
        status: !hit ? "tidak_terdaftar" : hit.status === "approved" ? "terdaftar" : hit.status === "needs_proof" ? "perlu_bukti" : "ditolak",
      });
    }
  }
  const order: Record<CaptionClaimStatus, number> = { ditolak: 0, tidak_terdaftar: 1, perlu_bukti: 2, terdaftar: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status]);
}

export { gayaClaimWords };
