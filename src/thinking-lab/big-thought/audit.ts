import type { AuditVerdict, IndividualAdmission } from "@/thinking-lab/shared/verdict";
import { fingerprintsMatch } from "@/thinking-lab/shared/fingerprint";
import type {
  AuditItem,
  LabSetRecord,
  SemanticExclusion,
  SemanticExclusionHistory,
  SiblingSetFacts,
} from "@/thinking-lab/big-thought/types";

function pairIncludes(pairs: Array<{ a: string; b: string }>, code: string): boolean {
  const target = code.toUpperCase();
  return pairs.some((pair) => pair.a.toUpperCase() === target || pair.b.toUpperCase() === target);
}

function contributionFor(set: SiblingSetFacts, code: string): string {
  const target = code.toUpperCase();
  return (
    (set.reasonContributions ?? [])
      .find((item) => item.code.toUpperCase() === target)
      ?.reasonContribution.trim() ?? ""
  );
}

/** A single active Big Thought has no sibling reasoning job to compare, so reasonContribution is not required and is not invented. Two or more require a stored model contribution for every code and an explanation on every conflict pair. */
export function siblingReasonProofReady(set: SiblingSetFacts | null, activeCodes: string[]): boolean {
  if (activeCodes.length < 2) return true;
  if (!set) return false;
  const pairs = set.duplicatePairs ?? [];
  if (pairs.some((pair) => !pair.explanation?.trim())) return false;
  return activeCodes.every((code) => contributionFor(set, code).length > 0);
}

export function scoreAuditRow(input: {
  code: string;
  admission: IndividualAdmission;
  siblingSet: SiblingSetFacts | null;
  siblingSetCurrent: boolean;
  activeCodes: string[];
}): AuditVerdict {
  if (input.admission === "STALE" || !input.siblingSetCurrent) return "STALE";
  if (input.admission === "UNRESOLVED") return "UNRESOLVED";
  if (!input.siblingSet) return "UNRESOLVED";
  if (input.siblingSet.resolution !== "RESOLVED" || input.siblingSet.unresolvedReasons.length > 0) {
    return "UNRESOLVED";
  }
  if (input.siblingSet.distinct === "unresolved") return "UNRESOLVED";
  if (!siblingReasonProofReady(input.siblingSet, input.activeCodes)) return "UNRESOLVED";
  if (input.admission === "GENERATE_REJECT") return "AUDIT_FAIL";
  const duplicated = pairIncludes(input.siblingSet.duplicatePairs, input.code);
  if (duplicated) return "AUDIT_FAIL";
  if (input.admission === "GENERATE_VALID") return "AUDIT_PASS";
  return "UNRESOLVED";
}

export function scoreAudit(input: {
  rows: Array<{ code: string; admission: IndividualAdmission }>;
  siblingSet: SiblingSetFacts | null;
  siblingSetCurrent: boolean;
}): AuditItem[] {
  const activeCodes = input.rows.map((row) => row.code);
  return input.rows.map((row) => ({
    code: row.code,
    verdict: scoreAuditRow({
      code: row.code,
      admission: row.admission,
      siblingSet: input.siblingSet,
      siblingSetCurrent: input.siblingSetCurrent,
      activeCodes,
    }),
  }));
}

export function countAuditPass(items: AuditItem[]): number {
  return items.filter((item) => item.verdict === "AUDIT_PASS").length;
}

export function siblingSetIsCurrent(stored: SiblingSetFacts | null, currentFingerprint: string): boolean {
  if (!stored) return false;
  return fingerprintsMatch(stored.fingerprint, currentFingerprint);
}

export function siblingSetNeedsFreshJudgment(
  stored: SiblingSetFacts | null,
  currentFingerprint: string,
  activeCodes: string[],
): boolean {
  if (!siblingSetIsCurrent(stored, currentFingerprint)) return true;
  return !siblingReasonProofReady(stored, activeCodes);
}

/** A Big Thought that already passed stays passed. Later scoring can change only the other rows. */
export function holdPassingAuditVerdicts(scored: AuditItem[], passingCodes: string[]): AuditItem[] {
  const passing = new Set(passingCodes.map((code) => code.toUpperCase()));
  return scored.map((item) => (passing.has(item.code.toUpperCase()) ? { ...item, verdict: "AUDIT_PASS" } : item));
}

/** Passes whose statement did not change. The edited code is left out so only that row is audited again. */
export function keptPassingAuditItems(input: {
  items: AuditItem[] | null | undefined;
  rows: Array<{ code: string; statementFingerprint: string }>;
  editedCode?: string;
}): AuditItem[] {
  const fingerprints = new Map(input.rows.map((row) => [row.code.toUpperCase(), row.statementFingerprint]));
  return (input.items ?? []).flatMap((item) => {
    if (item.verdict !== "AUDIT_PASS") return [];
    if (input.editedCode && item.code.toUpperCase() === input.editedCode.toUpperCase()) return [];
    const fingerprint = fingerprints.get(item.code.toUpperCase());
    if (!fingerprint) return [];
    if (item.statementFingerprint && !fingerprintsMatch(item.statementFingerprint, fingerprint)) return [];
    return [{ code: item.code, verdict: "AUDIT_PASS" as const, statementFingerprint: item.statementFingerprint ?? fingerprint }];
  });
}

export function displayedAuditVerdict(
  items: AuditItem[] | null | undefined,
  storedSetFingerprint: string | null | undefined,
  currentSetFingerprint: string,
  code: string,
  proof?: { siblingSet: SiblingSetFacts | null; activeCodes: string[] },
  currentStatementFingerprint?: string,
): AuditVerdict | null {
  const matched = items?.find((item) => item.code.toUpperCase() === code.toUpperCase());
  if (
    (matched?.verdict === "AUDIT_PASS" || matched?.verdict === "AUDIT_FAIL") &&
    matched.statementFingerprint &&
    currentStatementFingerprint &&
    fingerprintsMatch(matched.statementFingerprint, currentStatementFingerprint)
  ) {
    return matched.verdict;
  }
  if (!items || !storedSetFingerprint) return null;
  if (!fingerprintsMatch(storedSetFingerprint, currentSetFingerprint)) return "STALE";
  const stored = items.find((item) => item.code === code)?.verdict ?? null;
  if (
    stored === "AUDIT_PASS" &&
    proof &&
    !siblingReasonProofReady(proof.siblingSet, proof.activeCodes)
  ) {
    return "UNRESOLVED";
  }
  return stored;
}

export function emptySetRecord(): LabSetRecord {
  return { schema: "thinking-lab/v1", siblingSet: null, audit: null, challenger: null, semanticExclusions: null };
}

export function clearSetConclusions(record: LabSetRecord | null): LabSetRecord {
  return {
    schema: "thinking-lab/v1",
    siblingSet: record?.siblingSet ?? null,
    audit: null,
    challenger: null,
    semanticExclusions: record?.semanticExclusions ?? null,
  };
}

function exclusionKey(entry: SemanticExclusion): string {
  return [
    entry.reasonContribution.trim(),
    entry.explanation.trim(),
    [...entry.codes].map((code) => code.trim().toUpperCase()).filter(Boolean).sort().join(","),
  ].join("\n");
}

export function exclusionsForParent(
  history: SemanticExclusionHistory | null | undefined,
  parentFingerprint: string,
): SemanticExclusion[] {
  if (!history || !fingerprintsMatch(history.parentFingerprint, parentFingerprint)) return [];
  return history.entries;
}

export function siblingSetBelongsToParent(set: SiblingSetFacts | null, parentFingerprint: string): boolean {
  if (!set) return false;
  const parent = parentFingerprint.trim();
  const fingerprint = set.fingerprint.trim();
  if (!parent || !fingerprint) return false;
  return fingerprint === parent || fingerprint.startsWith(`${parent}\n`);
}

export function exclusionsFromSiblingSet(set: SiblingSetFacts | null): SemanticExclusion[] {
  if (!set) return [];
  const entries: SemanticExclusion[] = [];
  for (const item of set.reasonContributions ?? []) {
    const reasonContribution = item.reasonContribution?.trim() ?? "";
    if (!reasonContribution) continue;
    entries.push({ reasonContribution, explanation: "", codes: [item.code] });
  }
  for (const pair of set.duplicatePairs ?? []) {
    const explanation = pair.explanation?.trim() ?? "";
    if (!explanation) continue;
    entries.push({ reasonContribution: "", explanation, codes: [pair.a, pair.b] });
  }
  return entries;
}

export function mergeExclusionEntries(
  current: SemanticExclusion[],
  incoming: SemanticExclusion[],
): SemanticExclusion[] {
  const seen = new Set(current.map(exclusionKey));
  const next = [...current];
  for (const entry of incoming) {
    const normalized = {
      reasonContribution: entry.reasonContribution.trim(),
      explanation: entry.explanation.trim(),
      codes: entry.codes.map((code) => code.trim()).filter(Boolean),
    };
    if (!normalized.reasonContribution && !normalized.explanation) continue;
    const key = exclusionKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }
  return next;
}

export function mergeExclusionHistory(
  history: SemanticExclusionHistory | null | undefined,
  incoming: SemanticExclusion[],
  parentFingerprint: string,
): SemanticExclusionHistory {
  return {
    parentFingerprint,
    entries: mergeExclusionEntries(exclusionsForParent(history, parentFingerprint), incoming),
  };
}

function sameExclusionHistory(
  left: SemanticExclusionHistory | null | undefined,
  right: SemanticExclusionHistory | null | undefined,
): boolean {
  const leftEntries = left?.entries ?? [];
  const rightEntries = right?.entries ?? [];
  if ((left?.parentFingerprint ?? "") !== (right?.parentFingerprint ?? "")) return false;
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every((entry, index) => exclusionKey(entry) === exclusionKey(rightEntries[index] ?? entry));
}

/** Pass and fail rows whose text did not change. Replaced codes are dropped. */
export function heldAuditAfterFix(input: {
  items: AuditItem[] | null | undefined;
  rows: Array<{ code: string; statementFingerprint: string }>;
  replacedCodes: string[];
}): AuditItem[] {
  const replaced = new Set(input.replacedCodes.map((code) => code.toUpperCase()));
  const fingerprints = new Map(input.rows.map((row) => [row.code.toUpperCase(), row.statementFingerprint]));
  return (input.items ?? []).flatMap((item) => {
    if (item.verdict !== "AUDIT_PASS" && item.verdict !== "AUDIT_FAIL") return [];
    if (replaced.has(item.code.toUpperCase())) return [];
    const fingerprint = fingerprints.get(item.code.toUpperCase());
    if (!fingerprint) return [];
    if (item.statementFingerprint && !fingerprintsMatch(item.statementFingerprint, fingerprint)) return [];
    return [{ code: item.code, verdict: item.verdict, statementFingerprint: item.statementFingerprint ?? fingerprint }];
  });
}

export function persistedSetRecordAfterFix(
  record: LabSetRecord | null,
  replaced: number,
  exclusions?: SemanticExclusionHistory | null,
  heldItems?: AuditItem[],
): { write: false } | { write: true; lastAudit: LabSetRecord } {
  const base = record ?? emptySetRecord();
  const semanticExclusions = exclusions === undefined ? base.semanticExclusions : exclusions;
  if (replaced === 0) {
    if (sameExclusionHistory(base.semanticExclusions, semanticExclusions)) return { write: false };
    return {
      write: true,
      lastAudit: {
        ...base,
        semanticExclusions,
      },
    };
  }
  return {
    write: true,
    lastAudit: {
      ...clearSetConclusions(base),
      semanticExclusions,
      audit: heldItems && heldItems.length > 0 ? { setFingerprint: "held", items: heldItems } : null,
    },
  };
}

export function nextAuthoritativeSetRecord(input: {
  record: LabSetRecord | null;
  parentFingerprint: string;
  siblingSet: SiblingSetFacts | null;
  audit: LabSetRecord["audit"];
  challenger: LabSetRecord["challenger"];
}): LabSetRecord {
  const outgoing = siblingSetBelongsToParent(input.record?.siblingSet ?? null, input.parentFingerprint)
    ? input.record?.siblingSet ?? null
    : null;
  return {
    schema: "thinking-lab/v1",
    siblingSet: input.siblingSet,
    audit: input.audit,
    challenger: input.challenger,
    semanticExclusions: mergeExclusionHistory(
      input.record?.semanticExclusions,
      exclusionsFromSiblingSet(outgoing),
      input.parentFingerprint,
    ),
  };
}

function parseSemanticExclusions(raw: unknown): SemanticExclusionHistory | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as { parentFingerprint?: unknown; entries?: unknown };
  if (typeof row.parentFingerprint !== "string" || !row.parentFingerprint.trim()) return null;
  const entries = Array.isArray(row.entries)
    ? row.entries.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as { reasonContribution?: unknown; explanation?: unknown; codes?: unknown };
        const reasonContribution = typeof item.reasonContribution === "string" ? item.reasonContribution.trim() : "";
        const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
        const codes = Array.isArray(item.codes)
          ? item.codes.filter((code): code is string => typeof code === "string" && code.trim().length > 0)
          : [];
        if (!reasonContribution && !explanation) return [];
        return [{ reasonContribution, explanation, codes }];
      })
    : [];
  return { parentFingerprint: row.parentFingerprint, entries };
}

export function parseLabSetRecord(raw: unknown): LabSetRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Partial<LabSetRecord>;
  if (row.schema !== "thinking-lab/v1") return null;
  return {
    schema: "thinking-lab/v1",
    siblingSet: row.siblingSet ?? null,
    audit: row.audit ?? null,
    challenger: row.challenger ?? null,
    semanticExclusions: parseSemanticExclusions(row.semanticExclusions),
  };
}
