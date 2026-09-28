import { describe, expect, it } from "vitest";
import { bigThoughtFingerprint, territoryFingerprint } from "@/thinking-lab/shared/fingerprint";
import { canShowGenerateAngle, evaluateAngleParent } from "@/thinking-lab/angle/eligibility";

const masterThoughtFingerprint = "master-fingerprint";
const bigThoughtStatement = "A locked parent thought.";
const territoryStatement = "A bounded space";
const bigThoughtFp = bigThoughtFingerprint({
  statement: bigThoughtStatement,
  masterThoughtFingerprint,
});
const territoryFp = territoryFingerprint({
  statement: territoryStatement,
  bigThoughtFingerprint: bigThoughtFp,
});

const territory = {
  id: "tr-1",
  status: "locked",
  statement: territoryStatement,
  semanticFingerprint: territoryFp,
  bigThoughtId: "bt-1",
};

const bigThought = {
  id: "bt-1",
  status: "locked",
  statement: bigThoughtStatement,
  semanticFingerprint: bigThoughtFp,
};

describe("evaluateAngleParent", () => {
  it("allows a locked current Territory on a locked current Big Thought", () => {
    const gate = evaluateAngleParent({ territory, bigThought, masterThoughtFingerprint });
    expect(gate.ok).toBe(true);
    if (gate.ok) expect(gate.territoryFingerprint).toBe(territoryFp);
  });

  it("blocks generation when the Territory is not locked", () => {
    expect(
      evaluateAngleParent({
        territory: { ...territory, status: "candidate" },
        bigThought,
        masterThoughtFingerprint,
      }),
    ).toEqual({ ok: false, reason: "PARENT_UNLOCKED" });
  });

  it("blocks generation when the Territory fingerprint is stale", () => {
    expect(
      evaluateAngleParent({
        territory: { ...territory, statement: "A replaced space" },
        bigThought,
        masterThoughtFingerprint,
      }),
    ).toEqual({ ok: false, reason: "PARENT_STALE" });
  });

  it("blocks generation when the Territory is missing", () => {
    expect(evaluateAngleParent({ territory: null, bigThought, masterThoughtFingerprint })).toEqual({
      ok: false,
      reason: "PARENT_MISSING",
    });
  });

  it("blocks generation when the parent chain is not the expected locked Big Thought", () => {
    expect(
      evaluateAngleParent({
        territory,
        bigThought: { ...bigThought, status: "candidate" },
        masterThoughtFingerprint,
      }),
    ).toEqual({ ok: false, reason: "PARENT_CHAIN_INVALID" });
    expect(
      evaluateAngleParent({
        territory,
        bigThought,
        masterThoughtFingerprint,
        expectedBigThoughtId: "bt-other",
      }),
    ).toEqual({ ok: false, reason: "PARENT_CHAIN_INVALID" });
    expect(
      evaluateAngleParent({
        territory,
        bigThought: { ...bigThought, id: "bt-other" },
        masterThoughtFingerprint,
      }),
    ).toEqual({ ok: false, reason: "PARENT_CHAIN_INVALID" });
  });
});

describe("canShowGenerateAngle", () => {
  it("shows the action only for a locked current Territory", () => {
    expect(
      canShowGenerateAngle(
        { status: "locked", statement: territoryStatement, semanticFingerprint: territoryFp },
        bigThoughtFp,
      ),
    ).toBe(true);
    expect(
      canShowGenerateAngle(
        { status: "candidate", statement: territoryStatement, semanticFingerprint: territoryFp },
        bigThoughtFp,
      ),
    ).toBe(false);
    expect(
      canShowGenerateAngle(
        { status: "locked", statement: "Changed", semanticFingerprint: territoryFp },
        bigThoughtFp,
      ),
    ).toBe(false);
  });
});
