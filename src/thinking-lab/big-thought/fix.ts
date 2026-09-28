import { parseModelJson } from "@/thinking-lab/shared/ai";
import { MAX_GENERATE_ROUNDS } from "@/thinking-lab/shared/limits";
import { mergeExclusionEntries, siblingReasonProofReady } from "@/thinking-lab/big-thought/audit";
import { parseGeneratedStatements } from "@/thinking-lab/big-thought/generate";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { judgeSiblingSet, parseBigThoughtJudge, parseSiblingSet } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts, SemanticExclusion, SiblingSetFacts } from "@/thinking-lab/big-thought/types";
import type { AuditVerdict, IndividualAdmission } from "@/thinking-lab/shared/verdict";

export const FIX_CANDIDATE_CODE = "NEW";

export function failureCodes(rows: Array<{ code: string; audit: AuditVerdict | null }>): string[] {
  return rows.filter((row) => row.audit === "AUDIT_FAIL").map((row) => row.code);
}

export type FixRowContext = {
  code: string;
  statement: string;
  reasonContribution: string | null;
};

export type FixFailure = FixRowContext & {
  audit: AuditVerdict | null;
};

export type FixAttempt = {
  failedCode: string;
  statement: string;
  admission: IndividualAdmission;
  relationToParent: string | null;
  judgmentVerdict: string | null;
  judgmentReason: string | null;
  precheck: "not_run" | "accepted" | "rejected";
  precheckNote: string | null;
};

export type FixOffer = {
  statement: string;
  facts: BigThoughtFacts;
  reasonContribution: string;
};

export type FixRowResult =
  | {
      code: string;
      result: "REPLACED";
      statement: string;
      facts: BigThoughtFacts;
      reasonContribution: string;
      attempts: FixAttempt[];
    }
  | { code: string; result: "OFFERS"; offers: FixOffer[]; attempts: FixAttempt[] }
  | { code: string; result: "NO_SAFE_REPLACEMENT"; attempts: FixAttempt[] };

export type SiblingPrecheck =
  | { accept: true; reasonContribution: string }
  | { accept: false; discovered: SemanticExclusion[] };

function sameCode(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function pairIncludes(pairs: Array<{ a: string; b: string }>, code: string): boolean {
  return pairs.some((pair) => sameCode(pair.a, code) || sameCode(pair.b, code));
}

function contributionFor(set: SiblingSetFacts, code: string): string {
  return (
    (set.reasonContributions ?? []).find((item) => sameCode(item.code, code))?.reasonContribution.trim() ?? ""
  );
}

export function discoveredPrecheckExclusions(
  set: SiblingSetFacts | null,
  candidateCode: string,
): SemanticExclusion[] {
  if (!set) return [];
  const reasonContribution = contributionFor(set, candidateCode);
  const pairs = (set.duplicatePairs ?? []).filter((pair) => pairIncludes([pair], candidateCode));
  if (pairs.length === 0) {
    return reasonContribution ? [{ reasonContribution, explanation: "", codes: [candidateCode] }] : [];
  }
  return pairs.map((pair) => ({
    reasonContribution,
    explanation: pair.explanation.trim(),
    codes: [pair.a, pair.b],
  }));
}

export function evaluateSiblingPrecheck(input: {
  candidateCode: string;
  siblingSet: SiblingSetFacts | null;
  activeCodes: string[];
}): SiblingPrecheck {
  const set = input.siblingSet;
  const discovered = discoveredPrecheckExclusions(set, input.candidateCode);
  if (!set || set.resolution !== "RESOLVED" || set.unresolvedReasons.length > 0 || set.distinct === "unresolved") {
    return { accept: false, discovered };
  }
  if (!siblingReasonProofReady(set, input.activeCodes)) return { accept: false, discovered };
  if (pairIncludes(set.duplicatePairs ?? [], input.candidateCode)) return { accept: false, discovered };
  if (input.activeCodes.length >= 2) {
    const reasonContribution = contributionFor(set, input.candidateCode);
    if (!reasonContribution) return { accept: false, discovered };
    return { accept: true, reasonContribution };
  }
  return { accept: true, reasonContribution: contributionFor(set, input.candidateCode) };
}

export async function precheckReplacementCandidate(
  input: {
    parentStatement: string;
    candidateStatement: string;
    incumbents: Array<{ code: string; statement: string }>;
    fingerprint: string;
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<SiblingPrecheck> {
  const rows = [
    ...input.incumbents.map((row) => ({ code: row.code, statement: row.statement })),
    { code: FIX_CANDIDATE_CODE, statement: input.candidateStatement },
  ];
  const siblingSet = await judgeSiblingSet(
    { parentStatement: input.parentStatement, rows, fingerprint: input.fingerprint },
    ask,
  );
  return evaluateSiblingPrecheck({
    candidateCode: FIX_CANDIDATE_CODE,
    siblingSet,
    activeCodes: rows.map((row) => row.code),
  });
}

export async function runFixReplacements(input: {
  failures: FixFailure[];
  incumbents: FixRowContext[];
  exclusions: SemanticExclusion[];
  propose: (context: {
    failure: FixFailure;
    incumbents: FixRowContext[];
    exclusions: SemanticExclusion[];
    attempt: number;
  }) => Promise<string | null>;
  listProposals?: (context: {
    failure: FixFailure;
    incumbents: FixRowContext[];
    exclusions: SemanticExclusion[];
  }) => Promise<string[]>;
  judge: (statement: string, incumbents: Array<{ code: string; statement: string }>) => Promise<BigThoughtFacts>;
  precheck: (context: { statement: string; incumbents: FixRowContext[] }) => Promise<SiblingPrecheck>;
  onAccepted?: (result: Extract<FixRowResult, { result: "REPLACED" }>) => Promise<void>;
}): Promise<{ results: FixRowResult[]; exclusions: SemanticExclusion[] }> {
  let incumbents = [...input.incumbents];
  let exclusions = [...input.exclusions];
  const results: FixRowResult[] = [];
  let acceptedCount = 0;
  const noteFor = (check: SiblingPrecheck): string | null => {
    if (check.accept) return check.reasonContribution.trim() || null;
    const notes = check.discovered
      .map((entry) => entry.explanation.trim() || entry.reasonContribution.trim())
      .filter(Boolean);
    return notes.length > 0 ? notes.join("\n") : null;
  };
  const failures = input.failures.filter((row) => row.audit === "AUDIT_FAIL");
  const acceptOffer = (
    statement: string,
    facts: BigThoughtFacts,
    check: Extract<SiblingPrecheck, { accept: true }>,
  ) => {
    acceptedCount += 1;
    incumbents = [
      ...incumbents,
      {
        code: `P${acceptedCount}`,
        statement,
        reasonContribution: check.reasonContribution || null,
      },
    ];
    return {
      statement,
      facts,
      reasonContribution: check.reasonContribution,
    };
  };
  for (const failure of failures) {
    if (input.listProposals) {
      const attempts: FixAttempt[] = [];
      const offers: FixOffer[] = [];
      const proposals = (await input.listProposals({ failure, incumbents, exclusions })).slice(0, 3);
      for (const raw of proposals) {
        const statement = raw.trim();
        if (!statement || statement === failure.statement.trim() || offers.some((offer) => offer.statement === statement)) {
          continue;
        }
        const facts = await input.judge(
          statement,
          incumbents.map((row) => ({ code: row.code, statement: row.statement })),
        );
        const admission = individualAdmission({ facts, factsCurrent: true });
        if (admission !== "GENERATE_VALID") {
          attempts.push({
            failedCode: failure.code,
            statement,
            admission,
            relationToParent: facts.relationToParent,
            judgmentVerdict: facts.judgmentVerdict ?? null,
            judgmentReason: facts.judgmentReason ?? null,
            precheck: "not_run",
            precheckNote: null,
          });
          continue;
        }
        const check = await input.precheck({ statement, incumbents });
        attempts.push({
          failedCode: failure.code,
          statement,
          admission,
          relationToParent: facts.relationToParent,
          judgmentVerdict: facts.judgmentVerdict ?? null,
          judgmentReason: facts.judgmentReason ?? null,
          precheck: check.accept ? "accepted" : "rejected",
          precheckNote: noteFor(check),
        });
        if (!check.accept) {
          exclusions = mergeExclusionEntries(exclusions, check.discovered);
          continue;
        }
        offers.push(acceptOffer(statement, facts, check));
      }
      if (offers.length === 0) incumbents = [...incumbents, failure];
      results.push(
        offers.length > 0
          ? { code: failure.code, result: "OFFERS", offers, attempts }
          : { code: failure.code, result: "NO_SAFE_REPLACEMENT", attempts },
      );
      continue;
    }
    let replaced: FixRowResult | null = null;
    const attempts: FixAttempt[] = [];
    for (let attempt = 1; attempt <= MAX_GENERATE_ROUNDS; attempt += 1) {
      const statement = (await input.propose({ failure, incumbents, exclusions, attempt }))?.trim() ?? "";
      if (!statement || statement === failure.statement.trim()) continue;
      const facts = await input.judge(
        statement,
        incumbents.map((row) => ({ code: row.code, statement: row.statement })),
      );
      const admission = individualAdmission({ facts, factsCurrent: true });
      if (admission !== "GENERATE_VALID") {
        attempts.push({
          failedCode: failure.code,
          statement,
          admission,
          relationToParent: facts.relationToParent,
          judgmentVerdict: facts.judgmentVerdict ?? null,
          judgmentReason: facts.judgmentReason ?? null,
          precheck: "not_run",
          precheckNote: null,
        });
        continue;
      }
      const check = await input.precheck({ statement, incumbents });
      attempts.push({
        failedCode: failure.code,
        statement,
        admission,
        relationToParent: facts.relationToParent,
        judgmentVerdict: facts.judgmentVerdict ?? null,
        judgmentReason: facts.judgmentReason ?? null,
        precheck: check.accept ? "accepted" : "rejected",
        precheckNote: noteFor(check),
      });
      if (!check.accept) {
        exclusions = mergeExclusionEntries(exclusions, check.discovered);
        continue;
      }
      acceptedCount += 1;
      incumbents = [
        ...incumbents,
        {
          code: `P${acceptedCount}`,
          statement,
          reasonContribution: check.reasonContribution || null,
        },
      ];
      replaced = {
        code: failure.code,
        result: "REPLACED",
        statement,
        facts,
        reasonContribution: check.reasonContribution,
        attempts,
      };
      await input.onAccepted?.(replaced);
      break;
    }
    if (!replaced) {
      incumbents = [...incumbents, failure];
    }
    results.push(replaced ?? { code: failure.code, result: "NO_SAFE_REPLACEMENT", attempts });
  }
  return { results, exclusions };
}

export type FixModelKind = "proposal" | "individual" | "adversarial" | "sibling";

export type FixModelResponse = {
  kind: FixModelKind;
  code?: string;
  valid: boolean;
  body: string;
};

function responseText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function presentFixModelResponse(
  kind: FixModelKind,
  script: string | null,
  siblingCodes: string[] = [],
): FixModelResponse {
  const raw = script?.trim() ?? "";
  if (kind === "proposal") {
    const statements = parseGeneratedStatements(raw ? parseModelJson(raw) : null);
    return {
      kind,
      valid: statements.length > 0,
      body: statements.length > 0 ? statements.join("\n\n") : raw,
    };
  }
  if (kind === "individual") {
    const facts = parseBigThoughtJudge(raw || null, FIX_CANDIDATE_CODE);
    const lines = [
      facts.whatItSays,
      `relationToParent: ${facts.relationToParent}`,
      `supportRole: ${facts.supportRole}`,
      `explainsWhyParentIsTrue: ${String(facts.explainsWhyParentIsTrue)}`,
      facts.unresolvedReasons.join(", "),
    ]
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      kind,
      valid: individualAdmission({ facts, factsCurrent: true }) === "GENERATE_VALID",
      body: lines.join("\n") || raw,
    };
  }
  if (kind === "adversarial") {
    const parsed = raw ? parseModelJson(raw) : null;
    const row =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { verdict?: unknown; reason?: unknown })
        : null;
    const verdict = responseText(row?.verdict);
    const reason = responseText(row?.reason);
    const body = [verdict, reason].filter(Boolean).join("\n");
    return {
      kind,
      valid: verdict === "CONFIRM_MATERIAL_SUPPORT" && reason.startsWith("Material support:"),
      body: body || raw,
    };
  }
  const codes = siblingCodes.length > 0 ? siblingCodes : [FIX_CANDIDATE_CODE];
  const facts = parseSiblingSet(raw || null, "display", codes);
  const unparsed =
    !raw ||
    facts.unresolvedReasons.includes("JUDGE_UNPARSEABLE") ||
    facts.unresolvedReasons.includes("JUDGE_UNAVAILABLE");
  if (unparsed) return { kind, valid: false, body: raw };
  const decision = evaluateSiblingPrecheck({
    candidateCode: FIX_CANDIDATE_CODE,
    siblingSet: facts,
    activeCodes: codes,
  });
  const lines = [
    ...facts.reasonContributions.map((item) => `${item.code}: ${item.reasonContribution}`),
    ...facts.duplicatePairs.map((pair) => `${pair.a} / ${pair.b}: ${pair.explanation}`),
    ...facts.unresolvedReasons,
  ];
  return { kind, valid: decision.accept, body: lines.join("\n") || raw };
}
