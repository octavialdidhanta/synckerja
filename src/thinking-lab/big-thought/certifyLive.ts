import { buildThinkingAiRequestBody } from "@/thinking-lab/shared/thinkingAiClient";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import {
  INDIVIDUAL_CERTIFICATION_CASES,
  SIBLING_CERTIFICATION_CASES,
  type CertificationCase,
} from "@/thinking-lab/big-thought/certificationCases";
import {
  classifyIndividualCase,
  classifySiblingCase,
  combineCertificationReport,
  infrastructureCertificationLive,
  type LiveObservation,
  type SiblingRunObservation,
} from "@/thinking-lab/big-thought/certificationReport";
import {
  CERTIFICATION_INTER_CALL_DELAY_MS,
  certificationDelay,
  certificationStageFromPrompt,
  isCertificationInfrastructureError,
  requestCertificationScript,
} from "@/thinking-lab/big-thought/certificationTransport";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { judgeBigThought, judgeSiblingSet } from "@/thinking-lab/big-thought/semantic";
import { bigThoughtFingerprint, incumbentSetFingerprint } from "@/thinking-lab/shared/fingerprint";

const REPEATS = 5;
const PARENT_FINGERPRINT = "thinking-lab-certification-parent";

function requireLiveFlag(): void {
  if (process.env.THINKING_LAB_LIVE_CERTIFICATION !== "1") {
    console.error(
      "Live semantic certification did not run. Set THINKING_LAB_LIVE_CERTIFICATION=1 to call the production judge. Default npm test stays offline.",
    );
    process.exit(1);
  }
}

const callCursor = { caseId: "unknown", runNumber: 0, issued: 0 };

async function askProduction(prompt: string): Promise<string> {
  if (callCursor.issued > 0) await certificationDelay(CERTIFICATION_INTER_CALL_DELAY_MS);
  callCursor.issued += 1;
  return requestCertificationScript({
    prompt,
    context: {
      caseId: callCursor.caseId,
      runNumber: callCursor.runNumber,
      stage: certificationStageFromPrompt(prompt),
    },
    token: process.env.THINKING_LAB_ACCESS_TOKEN?.trim() ?? "",
    url: `${SUPABASE_URL}/functions/v1/generate-script-ai`,
    anonKey: SUPABASE_ANON_KEY,
    body: buildThinkingAiRequestBody(prompt, 0),
  });
}

async function observeIndividual(testCase: CertificationCase): Promise<LiveObservation> {
  const facts = await judgeBigThought(
    {
      parentStatement: testCase.parentStatement,
      candidate: { code: "NEW", statement: testCase.candidateStatement },
      siblings: [],
    },
    askProduction,
  );
  return {
    relationToParent: facts.relationToParent,
    supportRole: facts.supportRole,
    resolution: facts.resolution,
    individualAdmission: individualAdmission({ facts, factsCurrent: true }),
  };
}

function relationAccepted(testCase: CertificationCase, run: LiveObservation): boolean {
  if (!testCase.acceptableRelations || run.individualAdmission === "UNRESOLVED") return true;
  if (run.individualAdmission !== "GENERATE_REJECT" && run.individualAdmission !== "GENERATE_VALID") return true;
  return testCase.acceptableRelations.some((relation) => relation === run.relationToParent);
}

function observeSibling(facts: {
  distinct: boolean | "unresolved";
  duplicatePairs: SiblingRunObservation["duplicatePairs"];
  reasonContributions: SiblingRunObservation["reasonContributions"];
}): SiblingRunObservation {
  return {
    distinct: facts.distinct,
    duplicatePairs: facts.duplicatePairs,
    reasonContributions: facts.reasonContributions,
  };
}

export async function runLiveCertification() {
  requireLiveFlag();
  callCursor.issued = 0;
  try {
    return await runLiveCases();
  } catch (error: unknown) {
    if (!isCertificationInfrastructureError(error)) throw error;
    return combineCertificationReport({
      deterministicStatus: "NOT_RUN",
      live: infrastructureCertificationLive([error.message]),
    });
  }
}

async function runLiveCases() {
  const criticalFailures: string[] = [];
  const acceptableAmbiguities: string[] = [];
  const falseNegatives: string[] = [];
  const repeatabilityFailures: string[] = [];
  const siblingFailures: string[] = [];

  for (const testCase of INDIVIDUAL_CERTIFICATION_CASES) {
    const runs: LiveObservation[] = [];
    for (let index = 0; index < REPEATS; index += 1) {
      callCursor.caseId = testCase.id;
      callCursor.runNumber = index + 1;
      runs.push(await observeIndividual(testCase));
    }
    const classified = classifyIndividualCase(testCase, runs);
    criticalFailures.push(...classified.criticalFailures);
    acceptableAmbiguities.push(...classified.acceptableAmbiguities);
    falseNegatives.push(...classified.falseNegatives);
    repeatabilityFailures.push(...classified.repeatabilityFailures);
    for (const run of runs) {
      if (!relationAccepted(testCase, run) && run.individualAdmission === "GENERATE_VALID") {
        criticalFailures.push(`${testCase.id}:relation`);
      }
    }
    if (classified.criticalFailures.length > 0 || classified.falseNegatives.length > 0 || classified.repeatabilityFailures.length > 0) {
      console.error(
        [
          `CERTIFICATION BLOCKER ${testCase.id}`,
          `expected: ${testCase.expectedAdmission}`,
          `actual: ${runs.map((run) => run.individualAdmission).join(",")}`,
          `repeatability: ${classified.repeatabilityFailures.includes(testCase.id) ? "OSCILLATED" : "STABLE"}`,
          "suspected failure pattern: individual admission crossed the golden boundary. Do not patch the production prompt in this task.",
        ].join("\n"),
      );
    }
    console.log(
      JSON.stringify({
        id: testCase.id,
        runs: runs.map((run) => ({
          relationToParent: run.relationToParent,
          supportRole: run.supportRole,
          resolution: run.resolution,
          individualAdmission: run.individualAdmission,
        })),
      }),
    );
  }

  for (const testCase of SIBLING_CERTIFICATION_CASES) {
    const fingerprint = incumbentSetFingerprint({
      masterThoughtFingerprint: PARENT_FINGERPRINT,
      bigThoughtFingerprints: testCase.rows.map((row) =>
        bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: PARENT_FINGERPRINT }),
      ),
    });
    const runs: SiblingRunObservation[] = [];
    for (let index = 0; index < REPEATS; index += 1) {
      callCursor.caseId = testCase.id;
      callCursor.runNumber = index + 1;
      const facts = await judgeSiblingSet(
        { parentStatement: testCase.parentStatement, rows: testCase.rows, fingerprint },
        askProduction,
      );
      runs.push(observeSibling(facts));
    }
    const classified = classifySiblingCase(testCase, runs);
    siblingFailures.push(...classified.siblingFailures);
    repeatabilityFailures.push(...classified.repeatabilityFailures);
    if (classified.siblingFailures.length > 0 || classified.repeatabilityFailures.length > 0) {
      console.error(
        [
          `CERTIFICATION BLOCKER ${testCase.id}`,
          `expected distinct: ${String(testCase.expectDistinct)}`,
          `actual distinct: ${runs.map((run) => String(run.distinct)).join(",")}`,
          `expected pair: ${testCase.expectPair ? `${testCase.expectPair.a}/${testCase.expectPair.b}` : "none"}`,
          `actual pairs: ${runs.map((run) => run.duplicatePairs.map((pair) => `${pair.a}/${pair.b}`).join("+") || "none").join(" | ")}`,
          `repeatability: ${classified.repeatabilityFailures.includes(testCase.id) ? "OSCILLATED" : "STABLE"}`,
          "suspected failure pattern: sibling distinctness crossed the golden boundary. Do not patch the production prompt in this task.",
        ].join("\n"),
      );
    }
    console.log(
      JSON.stringify({
        id: testCase.id,
        runs: runs.map((run) => ({
          distinct: run.distinct,
          duplicatePairs: run.duplicatePairs.map((pair) => [pair.a, pair.b]),
          reasonContributions: run.reasonContributions.map((item) => item.code),
        })),
      }),
    );
  }

  const liveFailed =
    criticalFailures.length > 0 ||
    falseNegatives.length > 0 ||
    repeatabilityFailures.length > 0 ||
    siblingFailures.length > 0;
  return combineCertificationReport({
    deterministicStatus: "NOT_RUN",
    live: {
      liveSemanticStatus: liveFailed ? "FAIL" : "PASS",
      criticalFailures: [...new Set(criticalFailures)],
      acceptableAmbiguities: [...new Set(acceptableAmbiguities)],
      falseNegatives: [...new Set(falseNegatives)],
      repeatabilityFailures: [...new Set(repeatabilityFailures)],
      siblingFailures: [...new Set(siblingFailures)],
      infrastructureFailures: [],
    },
  });
}
