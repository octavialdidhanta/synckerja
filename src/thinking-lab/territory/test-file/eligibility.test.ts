import { describe, expect, it } from "vitest";
import { bigThoughtFingerprint, territoryFingerprint } from "@/thinking-lab/shared/fingerprint";
import { canGenerateAngle, canGenerateTerritory, evaluateTerritoryParent } from "@/thinking-lab/territory/eligibility";

const statement = "A locked parent thought.";
const masterThoughtFingerprint = "master-fingerprint";
const current = bigThoughtFingerprint({ statement, masterThoughtFingerprint });

describe("evaluateTerritoryParent", () => {
  it("allows a locked Big Thought whose fingerprint still matches", () => {
    const parent = { status: "locked", statement, semanticFingerprint: current };
    expect(evaluateTerritoryParent(parent, masterThoughtFingerprint)).toEqual({ ok: true });
    expect(canGenerateTerritory(parent, masterThoughtFingerprint)).toBe(true);
  });

  it("denies an unlocked Big Thought", () => {
    expect(
      evaluateTerritoryParent(
        { status: "candidate", statement, semanticFingerprint: current },
        masterThoughtFingerprint,
      ),
    ).toEqual({ ok: false, reason: "PARENT_UNLOCKED" });
  });

  it("denies a stale Big Thought", () => {
    expect(
      evaluateTerritoryParent(
        { status: "locked", statement: "A changed statement.", semanticFingerprint: current },
        masterThoughtFingerprint,
      ),
    ).toEqual({ ok: false, reason: "PARENT_STALE" });
  });

  it("denies a missing Big Thought", () => {
    expect(evaluateTerritoryParent(null, masterThoughtFingerprint)).toEqual({
      ok: false,
      reason: "PARENT_MISSING",
    });
  });

  it("allows Generate Angle only for a locked current Territory", () => {
    const parent = bigThoughtFingerprint({ statement, masterThoughtFingerprint });
    const territory = {
      status: "locked",
      statement: "A bounded space",
      semanticFingerprint: territoryFingerprint({ statement: "A bounded space", bigThoughtFingerprint: parent }),
    };
    expect(canGenerateAngle(territory, parent)).toBe(true);
    expect(canGenerateAngle({ ...territory, status: "candidate" }, parent)).toBe(false);
  });
});
