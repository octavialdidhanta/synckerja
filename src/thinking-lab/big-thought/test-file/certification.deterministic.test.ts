import { describe, expect, it } from "vitest";
import { scoreAudit } from "@/thinking-lab/big-thought/audit";
import {
  INDIVIDUAL_CERTIFICATION_CASES,
  SIBLING_CERTIFICATION_CASES,
} from "@/thinking-lab/big-thought/certificationCases";
import {
  admissionAllowed,
  certificationExitCode,
  classifyIndividualCase,
  classifySiblingCase,
  combineCertificationReport,
  deterministicStatusFromExitCode,
  overallCertificationStatus,
  siblingPairCovers,
  type SiblingRunObservation,
} from "@/thinking-lab/big-thought/certificationReport";
import { lockDecisionFromScoredSet } from "@/thinking-lab/big-thought/certificationSafety";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import type { BigThoughtFacts, ChallengerFacts, ParentRelation, SiblingSetFacts } from "@/thinking-lab/big-thought/types";

function facts(overrides: Partial<BigThoughtFacts> = {}): BigThoughtFacts {
  return {
    code: "BT01",
    whatItSays: "A distinct material support",
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole: "REASON",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

function provedSet(codes: string[]): SiblingSetFacts {
  return {
    fingerprint: "set-fp",
    distinct: true,
    duplicatePairs: [],
    reasonContributions: codes.map((code) => ({ code, reasonContribution: `${code} distinct job` })),
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

function completeChallenger(): ChallengerFacts {
  return {
    setFingerprint: "set-fp",
    status: "COMPLETE",
    missingWhyDescription: "",
    missingWhyBoundary: "",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

const threeValid = ["BT01", "BT02", "BT03"].map((code) => ({
  code,
  admission: "GENERATE_VALID" as const,
}));

describe("certification corpus", () => {
  it("keeps golden cases as data with unique ids", () => {
    const ids = INDIVIDUAL_CERTIFICATION_CASES.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "restatement-continuation",
        "negation-inversion",
        "normative-elaboration",
        "mixed-premise-conclusion",
        "clean-causal-premise",
        "loss-of-control",
        "evaluative-evidence",
        "evaluative-restatement",
        "weak-consistency",
        "strong-pattern",
        "method-only",
        "criterion-only",
        "unsupported-premise",
        "multiple-jobs",
      ]),
    );
    expect(SIBLING_CERTIFICATION_CASES.map((row) => row.id)).toEqual([
      "sibling-duplicate-job",
      "sibling-distinct-jobs",
    ]);
  });

  it("accepts only GENERATE_REJECT or UNRESOLVED for NOT_VALID", () => {
    expect(admissionAllowed("NOT_VALID", "GENERATE_REJECT")).toBe(true);
    expect(admissionAllowed("NOT_VALID", "UNRESOLVED")).toBe(true);
    expect(admissionAllowed("NOT_VALID", "GENERATE_VALID")).toBe(false);
    expect(admissionAllowed("NOT_VALID", "STALE")).toBe(false);
    expect(admissionAllowed("GENERATE_REJECT", "GENERATE_REJECT")).toBe(true);
  });
});

describe("certification policy completeness", () => {
  it("rejects the canonical exclusion relations that the older policy list did not name", () => {
    const relations: ParentRelation[] = ["CONSEQUENCE", "CRITERION", "EXAMPLE", "TACTIC", "EXECUTION"];
    for (const relationToParent of relations) {
      expect(
        individualAdmission({
          facts: facts({ relationToParent, supportRole: "UNRESOLVED", explainsWhyParentIsTrue: false }),
          factsCurrent: true,
        }),
      ).toBe("GENERATE_REJECT");
    }
  });
});

describe("certification lock stays closed", () => {
  const sibling = provedSet(["BT01", "BT02", "BT03"]);
  const challenger = completeChallenger();

  it("locks only a fully passing current set", () => {
    expect(
      lockDecisionFromScoredSet({
        rows: threeValid,
        siblingSet: sibling,
        siblingSetCurrent: true,
        challenger,
        challengerCurrent: true,
      }),
    ).toEqual({ ok: true });
  });

  it("blocks a stale individual fingerprint before lock", () => {
    const stale = individualAdmission({ facts: facts(), factsCurrent: false });
    expect(stale).toBe("STALE");
    const items = scoreAudit({
      rows: [
        { code: "BT01", admission: stale },
        { code: "BT02", admission: "GENERATE_VALID" },
        { code: "BT03", admission: "GENERATE_VALID" },
      ],
      siblingSet: sibling,
      siblingSetCurrent: true,
    });
    expect(items[0]?.verdict).toBe("STALE");
    expect(
      lockDecisionFromScoredSet({
        rows: [
          { code: "BT01", admission: stale },
          { code: "BT02", admission: "GENERATE_VALID" },
          { code: "BT03", admission: "GENERATE_VALID" },
        ],
        siblingSet: sibling,
        siblingSetCurrent: true,
        challenger,
        challengerCurrent: true,
      }).ok,
    ).toBe(false);
  });

  it("blocks a duplicate sibling pair and a stale sibling fingerprint", () => {
    const duplicated: SiblingSetFacts = {
      ...sibling,
      distinct: false,
      duplicatePairs: [{ a: "BT01", b: "BT02", explanation: "Same reasoning job" }],
    };
    expect(
      lockDecisionFromScoredSet({
        rows: threeValid,
        siblingSet: duplicated,
        siblingSetCurrent: true,
        challenger,
        challengerCurrent: true,
      }).ok,
    ).toBe(false);
    expect(
      lockDecisionFromScoredSet({
        rows: threeValid,
        siblingSet: sibling,
        siblingSetCurrent: false,
        challenger,
        challengerCurrent: true,
      }).ok,
    ).toBe(false);
  });

  it("blocks fewer than three passes and a sibling set without reason proof", () => {
    expect(
      lockDecisionFromScoredSet({
        rows: threeValid.slice(0, 2),
        siblingSet: provedSet(["BT01", "BT02"]),
        siblingSetCurrent: true,
        challenger,
        challengerCurrent: true,
      }).ok,
    ).toBe(false);
    expect(
      lockDecisionFromScoredSet({
        rows: threeValid,
        siblingSet: { ...sibling, reasonContributions: [] },
        siblingSetCurrent: true,
        challenger,
        challengerCurrent: true,
      }).ok,
    ).toBe(false);
  });

  it("blocks an unresolved admission and an open challenger", () => {
    expect(
      lockDecisionFromScoredSet({
        rows: [
          { code: "BT01", admission: "UNRESOLVED" },
          { code: "BT02", admission: "GENERATE_VALID" },
          { code: "BT03", admission: "GENERATE_VALID" },
        ],
        siblingSet: sibling,
        siblingSetCurrent: true,
        challenger,
        challengerCurrent: true,
      }).ok,
    ).toBe(false);
    const open = [
      { ...challenger, status: "MISSING_MATERIAL_SUPPORT" as const },
      { ...challenger, status: "UNRESOLVED" as const },
      { ...challenger, resolution: "UNRESOLVED" as const, unresolvedReasons: ["UNCLEAR"] },
    ];
    for (const row of open) {
      expect(
        lockDecisionFromScoredSet({
          rows: threeValid,
          siblingSet: sibling,
          siblingSetCurrent: true,
          challenger: row,
          challengerCurrent: true,
        }),
      ).toMatchObject({ ok: false, reason: "CHALLENGER" });
    }
    expect(
      lockDecisionFromScoredSet({
        rows: threeValid,
        siblingSet: sibling,
        siblingSetCurrent: true,
        challenger: null,
        challengerCurrent: true,
      }),
    ).toMatchObject({ ok: false, reason: "CHALLENGER" });
    expect(
      lockDecisionFromScoredSet({
        rows: threeValid,
        siblingSet: sibling,
        siblingSetCurrent: true,
        challenger,
        challengerCurrent: false,
      }),
    ).toMatchObject({ ok: false, reason: "CHALLENGER" });
  });
});

describe("certification report", () => {
  const restatement = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "restatement-continuation");
  const clean = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "clean-causal-premise");

  it("keeps a deterministic pass pending until live certification runs", () => {
    expect(
      overallCertificationStatus({
        deterministicStatus: "PASS",
        liveSemanticStatus: "NOT_RUN",
        criticalFailures: [],
        falseNegatives: [],
        repeatabilityFailures: [],
        siblingFailures: [],
      }),
    ).toBe("PENDING_LIVE");
  });

  it("records a valid leak and a missed material support without calling a model", () => {
    expect(restatement).toBeTruthy();
    expect(clean).toBeTruthy();
    const leaked = classifyIndividualCase(restatement!, [
      {
        relationToParent: "DISTINCT_MATERIAL_SUPPORT",
        supportRole: "PREMISE",
        resolution: "RESOLVED",
        individualAdmission: "GENERATE_VALID",
      },
    ]);
    expect(leaked.criticalFailures).toContain("restatement-continuation");
    const missed = classifyIndividualCase(clean!, [
      {
        relationToParent: "ELABORATION",
        supportRole: "UNRESOLVED",
        resolution: "RESOLVED",
        individualAdmission: "GENERATE_REJECT",
      },
    ]);
    expect(missed.falseNegatives).toContain("clean-causal-premise");
    const unresolvedReject = classifyIndividualCase(restatement!, [
      {
        relationToParent: "UNRESOLVED",
        supportRole: "UNRESOLVED",
        resolution: "UNRESOLVED",
        individualAdmission: "UNRESOLVED",
      },
    ]);
    expect(unresolvedReject.criticalFailures).toContain("restatement-continuation");
    expect(siblingPairCovers([{ a: "BT02", b: "BT01", explanation: "same job" }], { a: "BT01", b: "BT02" })).toBe(
      true,
    );
  });

  it("rejects STALE on a NOT_VALID case and a resolved support role outside the golden list", () => {
    const weak = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "weak-consistency");
    const loss = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "loss-of-control");
    expect(weak).toBeTruthy();
    expect(clean).toBeTruthy();
    expect(loss).toBeTruthy();
    const stale = classifyIndividualCase(weak!, [
      {
        relationToParent: "UNRESOLVED",
        supportRole: "UNRESOLVED",
        resolution: "UNRESOLVED",
        individualAdmission: "STALE",
      },
    ]);
    expect(stale.criticalFailures).toContain("weak-consistency");
    const mismatch = classifyIndividualCase(clean!, [
      {
        relationToParent: "DISTINCT_MATERIAL_SUPPORT",
        supportRole: "EVIDENCE",
        resolution: "RESOLVED",
        individualAdmission: "GENERATE_VALID",
      },
    ]);
    expect(mismatch.criticalFailures).toContain("clean-causal-premise:supportRole:EVIDENCE");
    const allowed = classifyIndividualCase(clean!, [
      {
        relationToParent: "DISTINCT_MATERIAL_SUPPORT",
        supportRole: "PREMISE",
        resolution: "RESOLVED",
        individualAdmission: "GENERATE_VALID",
      },
    ]);
    expect(allowed.criticalFailures).toEqual([]);
    const unspecified = classifyIndividualCase(loss!, [
      {
        relationToParent: "DISTINCT_MATERIAL_SUPPORT",
        supportRole: "EVIDENCE",
        resolution: "RESOLVED",
        individualAdmission: "GENERATE_VALID",
      },
    ]);
    expect(unspecified.criticalFailures).toEqual([]);
  });
});

describe("certification aggregation", () => {
  const passedLive = {
    liveSemanticStatus: "PASS" as const,
    criticalFailures: [],
    acceptableAmbiguities: [],
    falseNegatives: [],
    repeatabilityFailures: [],
    siblingFailures: [],
  };

  it("maps a real process exit to deterministic status and a combined overall", () => {
    expect(deterministicStatusFromExitCode(0)).toBe("PASS");
    expect(deterministicStatusFromExitCode(1)).toBe("FAIL");
    expect(deterministicStatusFromExitCode(null)).toBe("FAIL");
    expect(combineCertificationReport({ deterministicStatus: "PASS", live: passedLive }).overall).toBe("CERTIFIED");
    expect(combineCertificationReport({ deterministicStatus: "PASS", live: null }).overall).toBe("PENDING_LIVE");
    expect(combineCertificationReport({ deterministicStatus: "FAIL", live: null }).overall).toBe("NOT_CERTIFIED");
    expect(combineCertificationReport({ deterministicStatus: "NOT_RUN", live: passedLive }).overall).toBe("NOT_CERTIFIED");
    expect(
      combineCertificationReport({
        deterministicStatus: "PASS",
        live: { ...passedLive, liveSemanticStatus: "FAIL", siblingFailures: ["sibling-duplicate-job"] },
      }).overall,
    ).toBe("NOT_CERTIFIED");
    expect(certificationExitCode("CERTIFIED")).toBe(0);
    expect(certificationExitCode("PENDING_LIVE")).toBe(2);
    expect(certificationExitCode("NOT_CERTIFIED")).toBe(1);
  });

  it("requires every sibling run to hold its boundary and records a flip", () => {
    const duplicate = SIBLING_CERTIFICATION_CASES.find((row) => row.id === "sibling-duplicate-job");
    const distinct = SIBLING_CERTIFICATION_CASES.find((row) => row.id === "sibling-distinct-jobs");
    expect(duplicate).toBeTruthy();
    expect(distinct).toBeTruthy();
    const duplicateHeld: SiblingRunObservation = {
      distinct: false,
      duplicatePairs: [{ a: "BT02", b: "BT01", explanation: "same reasoning job, wording ignored" }],
      reasonContributions: [],
    };
    const fullyDistinct: SiblingRunObservation = {
      distinct: true,
      duplicatePairs: [],
      reasonContributions: [
        { code: "BT01", reasonContribution: "different stewards" },
        { code: "BT02", reasonContribution: "mandate" },
        { code: "BT03", reasonContribution: "loss of control" },
      ],
    };
    expect(classifySiblingCase(duplicate!, Array.from({ length: 5 }, () => duplicateHeld))).toEqual({
      siblingFailures: [],
      repeatabilityFailures: [],
    });
    const flippedDuplicate = classifySiblingCase(duplicate!, [
      duplicateHeld,
      duplicateHeld,
      duplicateHeld,
      duplicateHeld,
      fullyDistinct,
    ]);
    expect(flippedDuplicate.siblingFailures).toContain("sibling-duplicate-job");
    expect(flippedDuplicate.repeatabilityFailures).toContain("sibling-duplicate-job");
    expect(classifySiblingCase(duplicate!, Array.from({ length: 5 }, () => fullyDistinct))).toEqual({
      siblingFailures: ["sibling-duplicate-job"],
      repeatabilityFailures: [],
    });
    expect(classifySiblingCase(distinct!, Array.from({ length: 5 }, () => fullyDistinct))).toEqual({
      siblingFailures: [],
      repeatabilityFailures: [],
    });
    const missingProof: SiblingRunObservation = {
      ...fullyDistinct,
      reasonContributions: [{ code: "BT01", reasonContribution: "only one job" }],
    };
    const flippedDistinct = classifySiblingCase(distinct!, [fullyDistinct, fullyDistinct, fullyDistinct, fullyDistinct, missingProof]);
    expect(flippedDistinct.siblingFailures).toContain("sibling-distinct-jobs");
    expect(flippedDistinct.repeatabilityFailures).toContain("sibling-distinct-jobs");
    expect(classifySiblingCase(distinct!, Array.from({ length: 5 }, () => missingProof)).repeatabilityFailures).toEqual([]);
  });
});
