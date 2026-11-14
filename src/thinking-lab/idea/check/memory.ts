// What earlier Ideas teach the next check and the next Generate round: the sentences that failed,
// and the Ideas that passed, which a new Idea must differ from. Relative imports only: the MCP server loads this file.
import type { IdeaCheckId } from "./ids";
import type { IdeaCriterion, IdeaValidation, IdeaValidationDecision } from "./record";

export type FailureMemoryItem = {
  code: string;
  statement: string;
  angleId: string;
  sameAngle: boolean;
  failed: Array<{ id: IdeaCheckId; reason: string }>;
  unverified: Array<{ id: IdeaCheckId; reason: string }>;
};

/** A passed Idea a new Idea is compared with. */
export type IdeaPeer = {
  code: string;
  statement: string;
  mechanism: string;
};

type StoredIdea = {
  code: string;
  statement: string;
  angleId: string;
  validation: IdeaValidation | null;
};

function remembered(input: {
  code: string;
  statement: string;
  angleId: string;
  sameAngle: boolean;
  decision: IdeaValidationDecision;
  criteria: readonly IdeaCriterion[];
}): FailureMemoryItem | null {
  if (input.decision === "LOLOS") return null;
  const pick = (status: IdeaCriterion["status"]) =>
    input.criteria
      .filter((criterion) => criterion.status === status && criterion.reason)
      .map((criterion) => ({ id: criterion.id, reason: criterion.reason }));
  const failed = pick("FAIL");
  const unverified = pick("BELUM_TERVERIFIKASI");
  if (failed.length === 0 && unverified.length === 0) return null;
  return { code: input.code, statement: input.statement, angleId: input.angleId, sameAngle: input.sameAngle, failed, unverified };
}

export function failureMemoryFromValidation(input: {
  code: string;
  statement: string;
  angleId: string;
  validation: IdeaValidation;
}): FailureMemoryItem | null {
  return remembered({ ...input, sameAngle: true, decision: input.validation.decision, criteria: input.validation.criteria });
}

/** Every failed sentence on this Angle first, then on its sibling Angles, each once. */
export function failureItemsFromIdeas(rows: readonly StoredIdea[], angleId: string): FailureMemoryItem[] {
  const items = rows.flatMap((row) => {
    if (!row.validation) return [];
    const sameAngle = row.angleId === angleId;
    const current = remembered({ ...row, sameAngle, decision: row.validation.decision, criteria: row.validation.criteria });
    const past = row.validation.auditHistory.flatMap((snapshot) => {
      const item = remembered({
        code: row.code,
        statement: snapshot.statement || row.statement,
        angleId: row.angleId,
        sameAngle,
        decision: snapshot.decision,
        criteria: snapshot.criteria,
      });
      return item ? [item] : [];
    });
    return [...(current ? [current] : []), ...past];
  });
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = [item.statement.trim().toLowerCase(), ...item.failed.map((row) => `${row.id}:${row.reason}`)].join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...unique.filter((item) => item.sameAngle), ...unique.filter((item) => !item.sameAngle)];
}

/** Ideas that passed, which a new Idea must differ from. */
export function peersFromIdeas(rows: readonly StoredIdea[]): IdeaPeer[] {
  return rows.flatMap((row) =>
    row.validation?.decision === "LOLOS"
      ? [{ code: row.code, statement: row.statement, mechanism: row.validation.mechanism }]
      : [],
  );
}

export function formatFailureMemory(items: readonly FailureMemoryItem[]): string {
  const lineFor = (item: FailureMemoryItem) => {
    const reasons = [
      ...item.failed.map((row) => `${row.id} FAIL: ${row.reason}`),
      ...item.unverified.map((row) => `${row.id} BELUM_TERVERIFIKASI: ${row.reason}`),
    ];
    return `${item.code}: ${item.statement}\n${reasons.join("\n")}`;
  };
  const same = items.filter((item) => item.sameAngle);
  const siblings = items.filter((item) => !item.sameAngle);
  return [
    "Ideas that failed or could not be verified on this Angle:",
    same.length ? same.map(lineFor).join("\n") : "(none)",
    "",
    "Ideas that failed or could not be verified on sibling Angles in this Territory:",
    siblings.length ? siblings.map(lineFor).join("\n") : "(none)",
  ].join("\n");
}

export function sameStatement(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/\s+/g, " ") === right.trim().toLowerCase().replace(/\s+/g, " ");
}
