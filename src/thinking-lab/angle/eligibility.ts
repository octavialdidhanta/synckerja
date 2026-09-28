import { bigThoughtFingerprint, fingerprintsMatch, territoryFingerprint } from "@/thinking-lab/shared/fingerprint";
import { canGenerateAngle as territoryIsLockedCurrent } from "@/thinking-lab/territory/eligibility";

export type AngleParentDenial = "PARENT_MISSING" | "PARENT_UNLOCKED" | "PARENT_STALE" | "PARENT_CHAIN_INVALID";

export type AngleTerritorySnapshot = {
  id: string;
  status: string;
  statement: string;
  semanticFingerprint: string | null;
  bigThoughtId: string;
};

export type AngleBigThoughtSnapshot = {
  id: string;
  status: string;
  statement: string;
  semanticFingerprint: string | null;
};

export function evaluateAngleParent(input: {
  territory: AngleTerritorySnapshot | null;
  bigThought: AngleBigThoughtSnapshot | null;
  masterThoughtFingerprint: string | null;
  expectedTerritoryId?: string;
  expectedBigThoughtId?: string;
}):
  | { ok: true; territoryFingerprint: string; bigThoughtFingerprint: string }
  | { ok: false; reason: AngleParentDenial } {
  const territory = input.territory;
  if (!territory) return { ok: false, reason: "PARENT_MISSING" };
  if (input.expectedTerritoryId && input.expectedTerritoryId !== territory.id) {
    return { ok: false, reason: "PARENT_MISSING" };
  }
  const bigThought = input.bigThought;
  if (!bigThought || bigThought.id !== territory.bigThoughtId) return { ok: false, reason: "PARENT_CHAIN_INVALID" };
  if (input.expectedBigThoughtId && input.expectedBigThoughtId !== bigThought.id) {
    return { ok: false, reason: "PARENT_CHAIN_INVALID" };
  }
  if (bigThought.status !== "locked") return { ok: false, reason: "PARENT_CHAIN_INVALID" };
  if (!input.masterThoughtFingerprint?.trim()) return { ok: false, reason: "PARENT_STALE" };
  const currentBigThoughtFingerprint = bigThoughtFingerprint({
    statement: bigThought.statement,
    masterThoughtFingerprint: input.masterThoughtFingerprint,
  });
  if (!fingerprintsMatch(bigThought.semanticFingerprint, currentBigThoughtFingerprint)) {
    return { ok: false, reason: "PARENT_CHAIN_INVALID" };
  }
  if (territory.status !== "locked") return { ok: false, reason: "PARENT_UNLOCKED" };
  const currentTerritoryFingerprint = territoryFingerprint({
    statement: territory.statement,
    bigThoughtFingerprint: currentBigThoughtFingerprint,
  });
  if (!fingerprintsMatch(territory.semanticFingerprint, currentTerritoryFingerprint)) {
    return { ok: false, reason: "PARENT_STALE" };
  }
  return {
    ok: true,
    territoryFingerprint: currentTerritoryFingerprint,
    bigThoughtFingerprint: currentBigThoughtFingerprint,
  };
}

export function canShowGenerateAngle(
  territory: { status: string; statement: string; semanticFingerprint: string | null } | null,
  parentBigThoughtFingerprint: string | null,
): boolean {
  return territoryIsLockedCurrent(territory, parentBigThoughtFingerprint);
}
