import type { CertificationCase, SiblingCertificationCase } from "@/thinking-lab/big-thought/certificationCases";
import type { ParentRelation, SameReasonPair, SupportRole } from "@/thinking-lab/big-thought/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export type CertificationRunStatus = "PASS" | "FAIL" | "NOT_RUN";
export type OverallCertificationStatus = "CERTIFIED" | "PENDING_LIVE" | "NOT_CERTIFIED";

export type LiveObservation = {
  relationToParent: string;
  supportRole: string;
  resolution: string;
  individualAdmission: IndividualAdmission;
};

export type SiblingRunObservation = {
  distinct: boolean | "unresolved";
  duplicatePairs: SameReasonPair[];
  reasonContributions: Array<{ code: string; reasonContribution: string }>;
};

export type CertificationReport = {
  deterministicStatus: CertificationRunStatus;
  liveSemanticStatus: CertificationRunStatus;
  criticalFailures: string[];
  acceptableAmbiguities: string[];
  falseNegatives: string[];
  repeatabilityFailures: string[];
  siblingFailures: string[];
  infrastructureFailures: string[];
  overall: OverallCertificationStatus;
};

export function admissionAllowed(expected: CertificationCase["expectedAdmission"], actual: IndividualAdmission): boolean {
  if (expected === "NOT_VALID") return actual === "GENERATE_REJECT" || actual === "UNRESOLVED";
  return actual === expected;
}

export function classifyIndividualCase(testCase: CertificationCase, runs: LiveObservation[]): {
  criticalFailures: string[];
  acceptableAmbiguities: string[];
  falseNegatives: string[];
  repeatabilityFailures: string[];
} {
  const criticalFailures: string[] = [];
  const acceptableAmbiguities: string[] = [];
  const falseNegatives: string[] = [];
  const repeatabilityFailures: string[] = [];
  const polarities = new Set(runs.map((run) => run.individualAdmission));
  const oscillates = polarities.has("GENERATE_VALID") && polarities.has("GENERATE_REJECT");
  if (testCase.critical && oscillates) {
    repeatabilityFailures.push(testCase.id);
    criticalFailures.push(testCase.id);
  }
  const leakedValid =
    testCase.expectedAdmission !== "GENERATE_VALID" && runs.some((run) => run.individualAdmission === "GENERATE_VALID");
  if (leakedValid) criticalFailures.push(testCase.id);
  if (testCase.expectedAdmission === "GENERATE_VALID" && runs.every((run) => run.individualAdmission !== "GENERATE_VALID")) {
    falseNegatives.push(testCase.id);
  }
  const neverResolvedReject =
    testCase.expectedAdmission === "GENERATE_REJECT" &&
    runs.length > 0 &&
    runs.every((run) => run.individualAdmission !== "GENERATE_REJECT" && run.individualAdmission !== "GENERATE_VALID");
  if (neverResolvedReject) criticalFailures.push(testCase.id);
  if (
    testCase.expectedAdmission === "NOT_VALID" &&
    runs.some((run) => !admissionAllowed(testCase.expectedAdmission, run.individualAdmission))
  ) {
    criticalFailures.push(testCase.id);
  }
  for (const run of runs) {
    if (
      testCase.acceptableSupportRoles &&
      run.individualAdmission === "GENERATE_VALID" &&
      run.resolution === "RESOLVED" &&
      !testCase.acceptableSupportRoles.includes(run.supportRole as SupportRole)
    ) {
      criticalFailures.push(`${testCase.id}:supportRole:${run.supportRole}`);
    }
    if (run.individualAdmission === "UNRESOLVED") {
      acceptableAmbiguities.push(`${testCase.id}:UNRESOLVED`);
    }
    if (
      run.individualAdmission === "GENERATE_REJECT" &&
      testCase.acceptableRelations &&
      !testCase.acceptableRelations.includes(run.relationToParent as ParentRelation)
    ) {
      acceptableAmbiguities.push(`${testCase.id}:${run.relationToParent}`);
    }
  }
  return {
    criticalFailures: [...new Set(criticalFailures)],
    acceptableAmbiguities: [...new Set(acceptableAmbiguities)],
    falseNegatives,
    repeatabilityFailures,
  };
}

function siblingContributionsPresent(testCase: SiblingCertificationCase, run: SiblingRunObservation): boolean {
  return testCase.rows.every((row) =>
    run.reasonContributions.some(
      (item) => item.code.toUpperCase() === row.code.toUpperCase() && item.reasonContribution.trim().length > 0,
    ),
  );
}

export function siblingRunHoldsBoundary(testCase: SiblingCertificationCase, run: SiblingRunObservation): boolean {
  if (testCase.expectDistinct) {
    return run.distinct === true && run.duplicatePairs.length === 0 && siblingContributionsPresent(testCase, run);
  }
  if (run.distinct === true) return false;
  return run.distinct === false && siblingPairCovers(run.duplicatePairs, testCase.expectPair);
}

export function classifySiblingCase(testCase: SiblingCertificationCase, runs: SiblingRunObservation[]): {
  siblingFailures: string[];
  repeatabilityFailures: string[];
} {
  const siblingFailures: string[] = [];
  const repeatabilityFailures: string[] = [];
  const held = runs.map((run) => siblingRunHoldsBoundary(testCase, run));
  const distinctValues = new Set(runs.map((run) => String(run.distinct)));
  const flipped = testCase.critical && runs.length > 1 && (new Set(held).size > 1 || distinctValues.size > 1);
  if (flipped) {
    repeatabilityFailures.push(testCase.id);
    siblingFailures.push(testCase.id);
  }
  if (runs.length === 0 || held.some((ok) => !ok)) siblingFailures.push(testCase.id);
  return {
    siblingFailures: [...new Set(siblingFailures)],
    repeatabilityFailures: [...new Set(repeatabilityFailures)],
  };
}

export function siblingPairCovers(pairs: SameReasonPair[], expected: { a: string; b: string } | null): boolean {
  if (!expected) return pairs.length === 0;
  const want = [expected.a, expected.b].map((code) => code.toUpperCase()).sort();
  return pairs.some((pair) => {
    const got = [pair.a, pair.b].map((code) => code.toUpperCase()).sort();
    return got[0] === want[0] && got[1] === want[1];
  });
}

export function overallCertificationStatus(input: {
  deterministicStatus: CertificationRunStatus;
  liveSemanticStatus: CertificationRunStatus;
  criticalFailures: string[];
  falseNegatives: string[];
  repeatabilityFailures: string[];
  siblingFailures: string[];
  infrastructureFailures?: string[];
}): OverallCertificationStatus {
  if (
    (input.infrastructureFailures?.length ?? 0) > 0 ||
    input.criticalFailures.length > 0 ||
    input.falseNegatives.length > 0 ||
    input.repeatabilityFailures.length > 0 ||
    input.siblingFailures.length > 0 ||
    input.deterministicStatus === "FAIL" ||
    input.liveSemanticStatus === "FAIL"
  ) {
    return "NOT_CERTIFIED";
  }
  if (input.deterministicStatus === "PASS" && input.liveSemanticStatus === "NOT_RUN") return "PENDING_LIVE";
  if (input.deterministicStatus === "PASS" && input.liveSemanticStatus === "PASS") return "CERTIFIED";
  return "NOT_CERTIFIED";
}

export function deterministicStatusFromExitCode(code: number | null): CertificationRunStatus {
  return code === 0 ? "PASS" : "FAIL";
}

export type LiveCertificationSlice = Omit<CertificationReport, "deterministicStatus" | "overall" | "infrastructureFailures"> & {
  infrastructureFailures?: string[];
};

export function infrastructureCertificationLive(lines: string[]): LiveCertificationSlice {
  return {
    liveSemanticStatus: "FAIL",
    criticalFailures: [],
    acceptableAmbiguities: [],
    falseNegatives: [],
    repeatabilityFailures: [],
    siblingFailures: [],
    infrastructureFailures: lines,
  };
}

export function combineCertificationReport(input: {
  deterministicStatus: CertificationRunStatus;
  live: LiveCertificationSlice | null;
}): CertificationReport {
  const report: CertificationReport = {
    deterministicStatus: input.deterministicStatus,
    liveSemanticStatus: input.live?.liveSemanticStatus ?? "NOT_RUN",
    criticalFailures: input.live?.criticalFailures ?? [],
    acceptableAmbiguities: input.live?.acceptableAmbiguities ?? [],
    falseNegatives: input.live?.falseNegatives ?? [],
    repeatabilityFailures: input.live?.repeatabilityFailures ?? [],
    siblingFailures: input.live?.siblingFailures ?? [],
    infrastructureFailures: input.live?.infrastructureFailures ?? [],
    overall: "NOT_CERTIFIED",
  };
  report.overall = overallCertificationStatus(report);
  return report;
}

export function certificationExitCode(overall: OverallCertificationStatus): number {
  if (overall === "CERTIFIED") return 0;
  if (overall === "PENDING_LIVE") return 2;
  return 1;
}
