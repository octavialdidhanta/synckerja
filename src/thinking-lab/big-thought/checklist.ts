import type { GateFailure, PassGateId } from "./types";

export type { GateFailure, PassGateId };

/** The six Big Thought checks, in the order they run. */
export const PASS_GATE_IDS: readonly PassGateId[] = [
  "resolved",
  "relation",
  "explains",
  "premise",
  "showable",
  "duplicate",
];

export type BigThoughtCheckId = PassGateId;

/** A stored check id, read as a current id. The earlier set-wide "sibling" check is now "duplicate". */
export function readBigThoughtCheckId(value: unknown): BigThoughtCheckId | null {
  if (value === "sibling") return "duplicate";
  return typeof value === "string" && (PASS_GATE_IDS as readonly string[]).includes(value) ? (value as BigThoughtCheckId) : null;
}

export type PassGateState = "pending" | "checking" | "pass" | "fail" | "unchecked";

/** Maps gateChain step state to checklist UI state (runner lives in passChecks.ts). */
export function gateStepToPassState(state: "pending" | "running" | "pass" | "fail"): PassGateState {
  if (state === "running") return "checking";
  if (state === "pending") return "pending";
  if (state === "pass") return "pass";
  return "fail";
}

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

export function readGateFailure(value: unknown): GateFailure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { gate?: unknown; reason?: unknown; earlier?: unknown };
  const gate = readBigThoughtCheckId(row.gate);
  if (!gate) return null;
  if (typeof row.reason !== "string" || !row.reason.trim()) return null;
  return {
    gate,
    reason: clip(row.reason),
    earlier: row.earlier === "unchecked" ? "unchecked" : "pass",
  };
}
