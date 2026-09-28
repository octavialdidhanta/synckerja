import { buildThinkingAiRequestBody } from "@/thinking-lab/shared/thinkingAiClient";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { scoreAuditRow } from "@/thinking-lab/big-thought/audit";
import {
  CERTIFICATION_INTER_CALL_DELAY_MS,
  certificationDelay,
  certificationStageFromPrompt,
  isCertificationInfrastructureError,
  requestCertificationScript,
} from "@/thinking-lab/big-thought/certificationTransport";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { judgeBigThought, judgeSiblingSet } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";

const REPEATS = 5;
const CANDIDATE_CODE = "NEW";
const PARENT =
  "Tanggung jawab dalam memberikan perpuluhan tidak berhenti pada penyerahan dana perpuluhan itu saja, tetapi kesungguhan memilih wadah yang akan mengelolanya juga merupakan bagian dari tanggung jawab pemberi.";

const CASES = [
  {
    caseId: "CONTROL_POSITIVE",
    statement: "Dampak dan integritas perpuluhan secara langsung dipengaruhi oleh pengelolaan entitas penerima.",
  },
  {
    caseId: "SUSPECT_A",
    statement:
      "Kelalaian dalam memilih penerima dapat merusak niat awal pemberi dan kesucian tindakan memberi itu sendiri.",
  },
  {
    caseId: "SUSPECT_B",
    statement:
      "Kesungguhan pemberi dalam memilih wadah pengelolaan perpuluhan mencerminkan kedalaman komitmennya terhadap tujuan dan prinsip-prinsip yang mendasari tindakan memberi itu sendiri.",
  },
  {
    caseId: "POSITIVE_LOSS_OF_CONTROL",
    statement: "Setelah dana diserahkan, pemberi kehilangan sebagian besar kendali langsung atas bagaimana dana tersebut digunakan.",
  },
  {
    caseId: "POSITIVE_INTENTION_NOT_GUARANTEE",
    statement:
      "Niat baik pemberi tidak dengan sendirinya menjamin bahwa dana akan dikelola sesuai dengan tujuan yang mendorong pemberian itu.",
  },
] as const;

const POSITIVE_CONTROLS = ["CONTROL_POSITIVE", "POSITIVE_LOSS_OF_CONTROL", "POSITIVE_INTENTION_NOT_GUARANTEE"] as const;
const SUSPECTS = ["SUSPECT_A", "SUSPECT_B"] as const;

type ReproductionClass =
  | "NO_STRUCTURAL_FAILURE_FOUND"
  | "REPRODUCIBLE_STRUCTURAL_FAILURE_FOUND"
  | "INCONCLUSIVE_INFRASTRUCTURE_OR_SAMPLE_LIMITATION";

type ReproductionRun = {
  caseId: string;
  run: number;
  relationToParent: BigThoughtFacts["relationToParent"] | null;
  supportRole: BigThoughtFacts["supportRole"] | null;
  explainsWhyParentIsTrue: BigThoughtFacts["explainsWhyParentIsTrue"] | null;
  introducesUnsupportedPremise: BigThoughtFacts["introducesUnsupportedPremise"] | null;
  resolution: BigThoughtFacts["resolution"] | null;
  judgmentVerdict: string | null;
  judgmentReason: string | null;
  auditVerdict: string | null;
  reasonContribution: string | null;
  unresolvedReasons: string[];
  infrastructureFailure: string | null;
};

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

function infrastructureMessage(error: unknown, caseId: string, run: number): string {
  if (isCertificationInfrastructureError(error)) return error.message;
  if (error instanceof Error) {
    return `TRANSPORT_FAILURE case=${caseId} run=${run} stage=unknown http=none scriptMissing=true error=${error.message}`;
  }
  return `TRANSPORT_FAILURE case=${caseId} run=${run} stage=unknown http=none scriptMissing=true error=Reproduction run failed before a verdict.`;
}

function isCleanDistinctMaterialSupport(run: ReproductionRun): boolean {
  const supportReady = run.supportRole === "PREMISE" || run.supportRole === "REASON" || run.supportRole === "EVIDENCE";
  return (
    run.infrastructureFailure === null &&
    run.relationToParent === "DISTINCT_MATERIAL_SUPPORT" &&
    supportReady &&
    run.explainsWhyParentIsTrue === true &&
    run.introducesUnsupportedPremise === false &&
    run.resolution === "RESOLVED" &&
    run.unresolvedReasons.length === 0 &&
    run.auditVerdict === "AUDIT_PASS"
  );
}

function classify(runs: ReproductionRun[]): ReproductionClass {
  const byCase = new Map<string, ReproductionRun[]>();
  for (const run of runs) {
    const list = byCase.get(run.caseId) ?? [];
    list.push(run);
    byCase.set(run.caseId, list);
  }
  const complete = CASES.every((testCase) => {
    const rows = byCase.get(testCase.caseId) ?? [];
    return rows.filter((run) => run.infrastructureFailure === null).length === REPEATS;
  });
  if (!complete) return "INCONCLUSIVE_INFRASTRUCTURE_OR_SAMPLE_LIMITATION";
  const repeated = (caseId: string) => (byCase.get(caseId) ?? []).every(isCleanDistinctMaterialSupport);
  const controlsStable = POSITIVE_CONTROLS.every(repeated);
  const suspectsRepeated = SUSPECTS.every(repeated);
  if (controlsStable && suspectsRepeated) return "REPRODUCIBLE_STRUCTURAL_FAILURE_FOUND";
  return "NO_STRUCTURAL_FAILURE_FOUND";
}

function countsFor(rows: ReproductionRun[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const run of rows) {
    const key = run.infrastructureFailure ? "INFRASTRUCTURE" : (run.relationToParent ?? "MISSING");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function judgeOnce(caseId: string, statement: string, run: number): Promise<ReproductionRun> {
  callCursor.caseId = caseId;
  callCursor.runNumber = run;
  try {
    const facts = await judgeBigThought(
      {
        parentStatement: PARENT,
        candidate: { code: CANDIDATE_CODE, statement },
        siblings: [],
      },
      askProduction,
    );
    const admission = individualAdmission({ facts, factsCurrent: true });
    const sibling = await judgeSiblingSet(
      {
        parentStatement: PARENT,
        rows: [{ code: CANDIDATE_CODE, statement }],
        fingerprint: `reproduction\n${caseId}`,
      },
      askProduction,
    );
    const contribution = sibling.reasonContributions.find((item) => item.code === CANDIDATE_CODE)?.reasonContribution.trim() ?? "";
    return {
      caseId,
      run,
      relationToParent: facts.relationToParent,
      supportRole: facts.supportRole,
      explainsWhyParentIsTrue: facts.explainsWhyParentIsTrue,
      introducesUnsupportedPremise: facts.introducesUnsupportedPremise,
      resolution: facts.resolution,
      judgmentVerdict: facts.judgmentVerdict ?? null,
      judgmentReason: facts.judgmentReason ?? null,
      auditVerdict: scoreAuditRow({
        code: CANDIDATE_CODE,
        admission,
        siblingSet: sibling,
        siblingSetCurrent: true,
        activeCodes: [CANDIDATE_CODE],
      }),
      reasonContribution: contribution || null,
      unresolvedReasons: facts.unresolvedReasons,
      infrastructureFailure: null,
    };
  } catch (error: unknown) {
    return {
      caseId,
      run,
      relationToParent: null,
      supportRole: null,
      explainsWhyParentIsTrue: null,
      introducesUnsupportedPremise: null,
      resolution: null,
      judgmentVerdict: null,
      judgmentReason: null,
      auditVerdict: null,
      reasonContribution: null,
      unresolvedReasons: [],
      infrastructureFailure: infrastructureMessage(error, caseId, run),
    };
  }
}

const runs: ReproductionRun[] = [];
for (const testCase of CASES) {
  for (let run = 1; run <= REPEATS; run += 1) {
    const result = await judgeOnce(testCase.caseId, testCase.statement, run);
    runs.push(result);
    console.log(JSON.stringify(result));
  }
}

const byCase = new Map<string, ReproductionRun[]>();
for (const run of runs) {
  const list = byCase.get(run.caseId) ?? [];
  list.push(run);
  byCase.set(run.caseId, list);
}
const cleanRunCount: Record<string, number> = {};
const classificationCounts: Record<string, Record<string, number>> = {};
const repeatability: Record<string, string> = {};
for (const testCase of CASES) {
  const rows = byCase.get(testCase.caseId) ?? [];
  const clean = rows.filter((run) => run.infrastructureFailure === null);
  cleanRunCount[testCase.caseId] = clean.length;
  classificationCounts[testCase.caseId] = countsFor(rows);
  const cleanPositive = rows.filter(isCleanDistinctMaterialSupport).length;
  repeatability[testCase.caseId] = `${cleanPositive}/${clean.length || 0} clean DISTINCT_MATERIAL_SUPPORT`;
}
const infrastructureFailures = runs.flatMap((run) => (run.infrastructureFailure ? [run.infrastructureFailure] : []));
const summary = {
  cleanRunCount,
  classificationCounts,
  repeatability,
  infrastructureFailures,
  suspectARepeatedCleanDistinctMaterialSupport: (byCase.get("SUSPECT_A") ?? []).length === REPEATS && (byCase.get("SUSPECT_A") ?? []).every(isCleanDistinctMaterialSupport),
  suspectBRepeatedCleanDistinctMaterialSupport: (byCase.get("SUSPECT_B") ?? []).length === REPEATS && (byCase.get("SUSPECT_B") ?? []).every(isCleanDistinctMaterialSupport),
  positiveControlsStable: POSITIVE_CONTROLS.every((caseId) => {
    const rows = byCase.get(caseId) ?? [];
    return rows.length === REPEATS && rows.every(isCleanDistinctMaterialSupport);
  }),
  classification: classify(runs),
};
console.log(JSON.stringify({ summary }));
console.log(summary.classification);
