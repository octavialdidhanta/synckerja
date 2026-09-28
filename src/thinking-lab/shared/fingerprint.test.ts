import { describe, expect, it } from "vitest";
import {
  bigThoughtFingerprint,
  fingerprintsMatch,
  incumbentSetFingerprint,
  masterThoughtFingerprint,
} from "@/thinking-lab/shared/fingerprint";

describe("thinking lab fingerprints", () => {
  it("changes the Big Thought fingerprint when the parent belief changes", () => {
    const firstParent = masterThoughtFingerprint({ statement: "Belief A", rootBelief: "Belief A" });
    const nextParent = masterThoughtFingerprint({ statement: "Belief B", rootBelief: "Belief B" });
    const first = bigThoughtFingerprint({ statement: "One why", masterThoughtFingerprint: firstParent });
    const next = bigThoughtFingerprint({ statement: "One why", masterThoughtFingerprint: nextParent });
    expect(fingerprintsMatch(first, next)).toBe(false);
  });

  it("keeps a statement fingerprint current when only the sibling set changes", () => {
    const parent = masterThoughtFingerprint({ statement: "Belief", rootBelief: "Belief" });
    const statementFingerprint = bigThoughtFingerprint({
      statement: "Unchanged why",
      masterThoughtFingerprint: parent,
    });
    const before = incumbentSetFingerprint({
      masterThoughtFingerprint: parent,
      bigThoughtFingerprints: [statementFingerprint, "other"],
    });
    const after = incumbentSetFingerprint({
      masterThoughtFingerprint: parent,
      bigThoughtFingerprints: [statementFingerprint, "other", "added"],
    });
    expect(before).not.toBe(after);
    expect(statementFingerprint).toBe(
      bigThoughtFingerprint({ statement: "Unchanged why", masterThoughtFingerprint: parent }),
    );
  });
});
