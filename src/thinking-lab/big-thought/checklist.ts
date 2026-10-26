import type { BigThoughtFacts, GateFailure, GeneratePassGate, ParentRelation, PassGateId } from "@/thinking-lab/big-thought/types";

export type { GateFailure, PassGateId };

export const PASS_GATE_IDS: readonly PassGateId[] = [
  "resolved",
  "relation",
  "role",
  "explains",
  "premise",
  "duplicate",
  "sibling",
];

export type PassGateState = "pending" | "checking" | "pass" | "fail" | "unchecked";

export type PassGateCheck = {
  id: PassGateId;
  state: PassGateState;
  reason: string;
};

export type GateLesson = {
  gate: PassGateId;
  reason: string;
  statement: string;
};

export type GateReport = {
  gate: PassGateId;
  phase: "checking" | "checked";
  outcome: "pass" | "fail";
};

export type PassChecklist = {
  items: PassGateCheck[];
  passed: boolean;
  lesson: GateLesson | null;
  failure: GateFailure | null;
  report?: GateReport | null;
};

const REJECT_RELATIONS = new Set<ParentRelation>([
  "RESTATEMENT",
  "ELABORATION",
  "OUTCOME",
  "CONSEQUENCE",
  "METHOD",
  "CRITERION",
  "EXAMPLE",
  "TACTIC",
  "EXECUTION",
  "DUPLICATE",
  "UNSUPPORTED_PREMISE",
]);

function clip(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).trimEnd()}...`;
}

function stopped(gate: PassGateId, reason: string, earlier: GateFailure["earlier"]): PassChecklist {
  const clean = clip(reason) || "This pass gate failed.";
  const index = PASS_GATE_IDS.indexOf(gate);
  return {
    items: PASS_GATE_IDS.map((id, itemIndex) => {
      if (itemIndex < index) return { id, state: earlier === "pass" ? "pass" : "unchecked", reason: "" };
      if (itemIndex === index) return { id, state: "fail", reason: clean };
      return { id, state: "unchecked", reason: "" };
    }),
    passed: false,
    lesson: null,
    failure: { gate, reason: clean, earlier },
  };
}

function passedChecklist(): PassChecklist {
  return {
    items: PASS_GATE_IDS.map((id) => ({ id, state: "pass", reason: "" })),
    passed: true,
    lesson: null,
    failure: null,
  };
}

/** One frame of the live checklist. Later gates stay pending until this gate is confirmed. */
export function checklistFrame(
  final: PassChecklist,
  gate: PassGateId,
  phase: "checking" | "checked",
): PassChecklist {
  const index = final.items.findIndex((item) => item.id === gate);
  const current = final.items[index] ?? { id: gate, state: "pending" as const, reason: "" };
  const outcome: GateReport["outcome"] = current.state === "fail" ? "fail" : "pass";
  return {
    items: final.items.map((item, itemIndex) => {
      if (itemIndex < index) return item;
      if (itemIndex === index) return phase === "checking" ? { ...current, state: "checking" } : current;
      return { ...item, state: phase === "checked" && outcome === "fail" ? "unchecked" : "pending" };
    }),
    passed: false,
    lesson: null,
    failure: phase === "checked" && outcome === "fail" ? final.failure : null,
    report: { gate, phase, outcome },
  };
}

/** Checking, then the confirmed result, stopping at the first failure. Unchecked gates are not reported. */
export function checklistFrames(final: PassChecklist): PassChecklist[] {
  const frames: PassChecklist[] = [];
  for (const item of final.items) {
    if (item.state !== "pass" && item.state !== "fail") continue;
    frames.push(checklistFrame(final, item.id, "checking"));
    frames.push(checklistFrame(final, item.id, "checked"));
    if (item.state === "fail") break;
  }
  return frames;
}

/** How long the live report stays on screen, in milliseconds. */
export function checklistReportPause(phase: GateReport["phase"] | undefined): number {
  if (phase === "checking") return 700;
  if (phase === "checked") return 900;
  return 0;
}

export function waitForChecklistReport(checklist: { report?: GateReport | null }): Promise<void> {
  const pause = checklistReportPause(checklist.report?.phase);
  if (!pause || typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, pause));
  });
}

/** The set-level sibling check, before a row-by-row result is known. */
export function setSiblingCheckingFrame(): PassChecklist {
  return {
    items: PASS_GATE_IDS.map((id) => ({
      id,
      state: id === "sibling" ? "checking" : "pending",
      reason: "",
    })),
    passed: false,
    lesson: null,
    failure: null,
    report: { gate: "sibling", phase: "checking", outcome: "pass" },
  };
}

/** Sibling is still in flight. Earlier individual gates stay confirmed. */
export function checkingSiblingFrame(individual: PassChecklist): PassChecklist {
  return checklistFrame(
    {
      ...individual,
      items: individual.items.map((item) => (item.id === "sibling" ? { ...item, state: "pass" } : item)),
    },
    "sibling",
    "checking",
  );
}

export function confirmedPassChecklist(): PassChecklist {
  return passedChecklist();
}

/** Audit checks Big Thoughts that already passed Generate. A stored generate failure stays out. */
export function bigThoughtReadyForAudit(row: {
  admission: string;
  gateFailure?: GateFailure | null;
  passConfirmed?: boolean;
}): boolean {
  if (row.admission === "GENERATE_REJECT") return false;
  if (row.gateFailure) return false;
  if (row.passConfirmed === true) return true;
  return row.admission === "GENERATE_VALID";
}

/** A Big Thought stays in the list only when no pass gate has failed. Failures stay stored. */
export function bigThoughtListed(row: {
  admission: string;
  audit?: string | null;
  gateFailure?: GateFailure | null;
  auditGateFailure?: GateFailure | null;
}): boolean {
  if (row.admission === "GENERATE_REJECT") return false;
  if (row.audit === "AUDIT_FAIL" || row.auditGateFailure) return true;
  if (row.gateFailure && row.audit !== "AUDIT_PASS") return false;
  return true;
}

export function pendingPassChecklist(): PassChecklist {
  return {
    items: PASS_GATE_IDS.map((id) => ({ id, state: "pending", reason: "" })),
    passed: false,
    lesson: null,
    failure: null,
  };
}

/** Individual gates only. Sibling stays unchecked until a later step applies it. */
export function evaluateIndividualChecklist(facts: BigThoughtFacts | null): PassChecklist {
  const finished =
    Boolean(facts) &&
    facts?.resolution === "RESOLVED" &&
    facts.unresolvedReasons.length === 0 &&
    Boolean(facts.whatItSays.trim()) &&
    facts.relationToParent !== "UNRESOLVED" &&
    facts.explainsWhyParentIsTrue !== "unresolved" &&
    facts.introducesUnsupportedPremise !== "unresolved";
  if (!finished || !facts) {
    return stopped("resolved", facts?.unresolvedReasons[0] || "The judgment is not finished.", "pass");
  }
  if (REJECT_RELATIONS.has(facts.relationToParent) || facts.relationToParent !== "DISTINCT_MATERIAL_SUPPORT") {
    return stopped("relation", facts.judgmentReason?.trim() || facts.relationToParent, "pass");
  }
  if (facts.supportRole !== "PREMISE" && facts.supportRole !== "REASON" && facts.supportRole !== "EVIDENCE") {
    return stopped("role", `supportRole ${facts.supportRole}`, "pass");
  }
  if (facts.explainsWhyParentIsTrue !== true) {
    return stopped("explains", "The clause does not explain why the Master Thought is true.", "pass");
  }
  if (facts.introducesUnsupportedPremise !== false) {
    return stopped("premise", "The clause introduces an unsupported premise.", "pass");
  }
  if (facts.duplicateOfCode) {
    return stopped("duplicate", `Duplicates ${facts.duplicateOfCode}.`, "pass");
  }
  return {
    items: PASS_GATE_IDS.map((id) => ({
      id,
      state: id === "sibling" ? "unchecked" : "pass",
      reason: "",
    })),
    passed: false,
    lesson: null,
    failure: null,
  };
}

export function individualChecklistPassed(facts: BigThoughtFacts): boolean {
  return evaluateIndividualChecklist(facts).failure === null;
}

export function uncheckedDuplicateChecklist(reason: string): PassChecklist {
  return stopped("duplicate", reason, "unchecked");
}

export function completeChecklist(
  individual: PassChecklist,
  sibling: { passed: boolean; reason: string },
): PassChecklist {
  if (individual.failure) return individual;
  if (!sibling.passed) return stopped("sibling", sibling.reason, "pass");
  return passedChecklist();
}

export function checklistFromFailure(failure: GateFailure): PassChecklist {
  return stopped(failure.gate, failure.reason, failure.earlier);
}

export function lessonFromFailure(statement: string, failure: GateFailure): GateLesson {
  return {
    gate: failure.gate,
    reason: failure.reason,
    statement: clip(statement),
  };
}

export function attachLesson(checklist: PassChecklist, statement: string): PassChecklist {
  if (!checklist.failure) return { ...checklist, lesson: null };
  return { ...checklist, lesson: lessonFromFailure(statement, checklist.failure) };
}

export function readGeneratePasses(value: unknown): GeneratePassGate[] {
  if (!Array.isArray(value)) return [];
  const found = new Set<GeneratePassGate>();
  for (const item of value) {
    if (item === "resolved" || item === "relation") found.add(item);
  }
  return (["resolved", "relation"] as const).filter((id) => found.has(id));
}

export function readGateFailure(value: unknown): GateFailure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { gate?: unknown; reason?: unknown; earlier?: unknown };
  if (typeof row.gate !== "string" || !PASS_GATE_IDS.includes(row.gate as PassGateId)) return null;
  if (typeof row.reason !== "string" || !row.reason.trim()) return null;
  return {
    gate: row.gate as PassGateId,
    reason: clip(row.reason),
    earlier: row.earlier === "unchecked" ? "unchecked" : "pass",
  };
}
