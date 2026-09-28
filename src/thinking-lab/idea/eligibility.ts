import { angleFingerprint, fingerprintsMatch, territoryFingerprint } from "@/thinking-lab/shared/fingerprint";
import type { AngleParentDenial } from "@/thinking-lab/angle/eligibility";
import { evaluateAngleParent } from "@/thinking-lab/angle/eligibility";

export type IdeaParentDenial = AngleParentDenial | "PARENT_UNLOCKED" | "PARENT_STALE" | "PARENT_MISSING";

export type IdeaAngleSnapshot = {
  id: string;
  status: string;
  statement: string;
  semanticFingerprint: string | null;
  territoryId: string;
};

export function evaluateIdeaParent(input: {
  angle: IdeaAngleSnapshot | null;
  territory: Parameters<typeof evaluateAngleParent>[0]["territory"];
  bigThought: Parameters<typeof evaluateAngleParent>[0]["bigThought"];
  masterThoughtFingerprint: string | null;
  expectedAngleId?: string;
  expectedTerritoryId?: string;
}): { ok: true; angleFingerprint: string; territoryFingerprint: string } | { ok: false; reason: IdeaParentDenial } {
  const angle = input.angle;
  if (!angle) return { ok: false, reason: "PARENT_MISSING" };
  if (input.expectedAngleId && input.expectedAngleId !== angle.id) return { ok: false, reason: "PARENT_MISSING" };
  if (!input.territory || input.territory.id !== angle.territoryId) return { ok: false, reason: "PARENT_CHAIN_INVALID" };
  const chain = evaluateAngleParent({
    territory: input.territory,
    bigThought: input.bigThought,
    masterThoughtFingerprint: input.masterThoughtFingerprint,
    expectedTerritoryId: input.expectedTerritoryId ?? angle.territoryId,
  });
  if (chain.ok === false) return chain;
  if (angle.status !== "locked") return { ok: false, reason: "PARENT_UNLOCKED" };
  const current = angleFingerprint({
    statement: angle.statement,
    territoryFingerprint: chain.territoryFingerprint,
  });
  if (!fingerprintsMatch(angle.semanticFingerprint, current)) return { ok: false, reason: "PARENT_STALE" };
  return { ok: true, angleFingerprint: current, territoryFingerprint: chain.territoryFingerprint };
}

export function canShowGenerateIdea(
  angle: { status: string; statement: string; semanticFingerprint: string | null } | null,
  parentTerritoryFingerprint: string | null,
): boolean {
  if (!angle || angle.status !== "locked" || !parentTerritoryFingerprint?.trim()) return false;
  const current = angleFingerprint({ statement: angle.statement, territoryFingerprint: parentTerritoryFingerprint });
  return fingerprintsMatch(angle.semanticFingerprint, current);
}

export function currentTerritoryFingerprintForIdea(input: {
  territoryStatement: string;
  bigThoughtFingerprint: string;
}): string {
  return territoryFingerprint({
    statement: input.territoryStatement,
    bigThoughtFingerprint: input.bigThoughtFingerprint,
  });
}
