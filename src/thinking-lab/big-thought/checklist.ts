import type { GateFailure, GeneratePassGate, PassGateId } from "./types";

export type { GateFailure, PassGateId };

export const PASS_GATE_IDS: readonly PassGateId[] = [
  "resolved",
  "relation",
  "explains",
  "premise",
  "showable",
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

/**
 * A short beat so each check visibly ticks. It used to be 0.7 s + 0.9 s per check, about 10 s of
 * waiting per Big Thought on top of the model calls.
 */
export function checklistReportPause(phase: GateReport["phase"] | undefined): number {
  if (phase === "checking") return 0;
  if (phase === "checked") return 150;
  return 0;
}

export function waitForChecklistReport(checklist: { report?: GateReport | null }): Promise<void> {
  const pause = checklistReportPause(checklist.report?.phase);
  if (!pause || typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, pause));
  });
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
