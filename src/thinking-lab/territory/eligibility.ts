import { bigThoughtFingerprint, fingerprintsMatch, territoryFingerprint } from "@/thinking-lab/shared/fingerprint";

export type TerritoryParentDenial = "PARENT_MISSING" | "PARENT_UNLOCKED" | "PARENT_STALE";

export type TerritoryParentSnapshot = {
  status: string;
  statement: string;
  semanticFingerprint: string | null;
};

export function evaluateTerritoryParent(
  parent: TerritoryParentSnapshot | null,
  masterThoughtFingerprint: string | null,
): { ok: true } | { ok: false; reason: TerritoryParentDenial } {
  if (!parent) return { ok: false, reason: "PARENT_MISSING" };
  if (parent.status !== "locked") return { ok: false, reason: "PARENT_UNLOCKED" };
  if (!masterThoughtFingerprint?.trim()) return { ok: false, reason: "PARENT_STALE" };
  const current = bigThoughtFingerprint({
    statement: parent.statement,
    masterThoughtFingerprint,
  });
  if (!fingerprintsMatch(parent.semanticFingerprint, current)) return { ok: false, reason: "PARENT_STALE" };
  return { ok: true };
}

export function canGenerateTerritory(
  parent: TerritoryParentSnapshot | null,
  masterThoughtFingerprint: string | null,
): boolean {
  return evaluateTerritoryParent(parent, masterThoughtFingerprint).ok;
}

export function canGenerateAngle(
  territory: { status: string; statement: string; semanticFingerprint: string | null } | null,
  parentBigThoughtFingerprint: string | null,
): boolean {
  if (!territory || territory.status !== "locked" || !parentBigThoughtFingerprint?.trim()) return false;
  const current = territoryFingerprint({
    statement: territory.statement,
    bigThoughtFingerprint: parentBigThoughtFingerprint,
  });
  return fingerprintsMatch(territory.semanticFingerprint, current);
}
