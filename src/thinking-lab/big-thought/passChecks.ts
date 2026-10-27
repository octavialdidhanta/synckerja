import { bigThoughtRepeats } from "@/thinking-lab/big-thought/label";
import type { PassChecklist, PassGateCheck, PassGateId } from "@/thinking-lab/big-thought/checklist";
import { PASS_GATE_IDS } from "@/thinking-lab/big-thought/checklist";
import { parseModelJson } from "@/thinking-lab/shared/ai";
import { fixScopeLines, openMistakeLines, type FixScope } from "@/thinking-lab/shared/fixScope";
import { parseGeneratedBigThoughts, shownBigThoughtFacts } from "@/thinking-lab/big-thought/generate";
import type { BigThoughtFacts, GeneratePassGate } from "@/thinking-lab/big-thought/types";

/** Generate admits a sentence only after these three. Audit repeats the duplicate check by meaning, and keeps the other two while the sentence stays the same. */
export const GENERATE_ADMISSION_GATES = ["duplicate", "resolved", "relation"] as const satisfies readonly PassGateId[];

const INDIVIDUAL_GATE_IDS = [
  "resolved",
  "relation",
  "role",
  "explains",
  "premise",
  "duplicate",
] as const satisfies readonly PassGateId[];

const UNDECIDED = "This check could not be decided.";

export function emptyBigThoughtChecks(): PassGateCheck[] {
  return PASS_GATE_IDS.map((id) => ({ id, state: "pending", reason: "" }));
}

function admissionChecklist(items: PassGateCheck[], report?: PassChecklist["report"]): PassChecklist {
  const watched = GENERATE_ADMISSION_GATES.map(
    (id) => items.find((item) => item.id === id) ?? { id, state: "unchecked" as const, reason: "" },
  );
  const failureItem = watched.find((item) => item.state === "fail");
  const failure = failureItem
    ? {
        gate: failureItem.id,
        reason: failureItem.reason || UNDECIDED,
        earlier: watched.some(
          (item) =>
            item.state === "pass" &&
            GENERATE_ADMISSION_GATES.findIndex((gate) => gate === item.id) <
              GENERATE_ADMISSION_GATES.findIndex((gate) => gate === failureItem.id),
        )
          ? ("pass" as const)
          : ("unchecked" as const),
      }
    : null;
  return {
    items: items.map((item) => ({ ...item })),
    passed: watched.every((item) => item.state === "pass"),
    lesson: null,
    failure,
    report: report ?? null,
  };
}

function checklistFrom(items: PassGateCheck[], report?: PassChecklist["report"]): PassChecklist {
  const failureItem = items.find((item) => item.state === "fail");
  const failure = failureItem
    ? {
        gate: failureItem.id,
        reason: failureItem.reason || UNDECIDED,
        earlier: items.some((item) => item.state === "pass") ? ("pass" as const) : ("unchecked" as const),
      }
    : null;
  return {
    items: items.map((item) => ({ ...item })),
    passed: failure == null && INDIVIDUAL_GATE_IDS.every((id) => items.some((item) => item.id === id && item.state === "pass")),
    lesson: null,
    failure,
    report: report ?? null,
  };
}

const GATE_REASON = /^([a-z][A-Za-z0-9]*):\s*([\s\S]+)$/;

/** Earlier failures for this gate only. Unprefixed reasons stay out so other gates do not leak in. */
export function lessonsForPassGate(
  lessons: ReadonlyArray<{ statement: string; reason: string }> | undefined,
  gate: string,
): Array<{ statement: string; reason: string }> {
  if (!lessons?.length) return [];
  return lessons.flatMap((lesson) => {
    const match = lesson.reason.trim().match(GATE_REASON);
    if (!match || match[1] !== gate) return [];
    const detail = match[2].trim();
    if (!detail) return [];
    return [{ statement: lesson.statement, reason: detail }];
  });
}

export function buildBigThoughtPassPrompt(input: {
  id: (typeof INDIVIDUAL_GATE_IDS)[number];
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string }>;
  lessons?: Array<{ statement: string; reason: string }>;
}): string {
  const rule =
    input.id === "resolved"
      ? [
          "pass is true only when the sentence is a finished claim that can be judged.",
          "pass is false when it is a fragment, a heading, or unfinished.",
        ]
      : input.id === "relation"
        ? [
            "pass is true only when this is a distinct material reason, basis, or evidence for the Master Thought, and inserting only the word because between the Master Thought and this sentence already makes one grammatical sentence. That sentence finishes the belief, including its comparison, without repeating the Master Thought and without opening a separate claim. One result of that same cause, joined with sehingga or so that, stays part of the reason.",
            "pass is false when the sentence is its own claim and would need to be rewritten before it can follow because, when it only names an area, or when it is a rarely noticed observation rather than a reason. It also fails when it restates the Master Thought, unpacks it, is only a bare outcome or a method, or is only an example, criterion, tactic, or execution. A bare outcome only follows after the Master Thought. The result also fails when it repeats the Master Thought or opens a second reason.",
          ]
        : input.id === "role"
          ? [
              "pass is true only when its job is a premise, a reason, or evidence.",
              "pass is false when that job cannot be named.",
            ]
          : input.id === "explains"
            ? [
                "pass is true only when the Master Thought is true because this sentence, and the sentence shows what that cause produces.",
                "pass is false when the because-form is circular or the result is missing.",
              ]
            : input.id === "premise"
              ? [
                  "pass is true when the sentence is an ordinary defensible premise, reason, or evidence for the Master Thought.",
                  "New material information that the Master Thought does not already state is allowed. Do not fail merely because the parent does not contain or prove this sentence.",
                  "pass is false only when the support depends on an unjustifiably specific empirical assertion that needs separate unstated evidence: invented factual certainty, universal or absolute guarantees, precise quantities or time horizons, or strong deterministic predictions that cannot stand without proof.",
                  "Ordinary product, process, or causal reasons may pass when they function as a defensible premise without fabricated certainty. Warning signs are not automatic rejection.",
                ]
              : [
                  "pass is true only when this is not the same Big Thought as one that already passed.",
                  "pass is false when it repeats one of those Big Thoughts.",
                ];
  const others =
    input.others.length === 0
      ? "(none)"
      : input.others.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const gateLessons = lessonsForPassGate(input.lessons, input.id);
  const lessonLines =
    gateLessons.length === 0
      ? []
      : [
          "",
          `Earlier ${input.id} failures for this Big Thought. Do not pass a sentence that repeats this mistake:`,
          ...gateLessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`),
        ];
  return [
    "Decide one Big Thought pass check. Do not rewrite the sentence.",
    ...rule,
    "When pass is false, reason says why in the same language as the Master Thought.",
    "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Big Thought: ${input.statement.trim()}`,
    "Master Thought:",
    input.parentStatement.trim(),
    ...(input.id === "duplicate" ? ["", "Big Thoughts that already passed:", others] : []),
    ...lessonLines,
  ].join("\n");
}

export function parseBigThoughtPassCheck(script: string | null): { pass: boolean; reason: string } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

export function buildBigThoughtFixPrompt(input: {
  parentStatement: string;
  failed: { code: string; statement: string };
  keepers: Array<{ code: string; statement: string }>;
  scope: FixScope;
  lessons?: Array<{ statement: string; reason: string }>;
}): string {
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const lessons = input.lessons ?? [];
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  return [
    "Rewrite only the failed part of this Big Thought.",
    "Keep the checks that already passed. Do not write a new Big Thought from the beginning.",
    "The sentence is one because-clause in the same language as the Master Thought.",
    "It is a distinct material reason, basis, or evidence for why the Master Thought is true.",
    "Do not repeat a keeper or the failed sentence.",
    ...fixScopeLines(input.scope),
    "Return JSON only: {\"items\":[{\"label\":\"\",\"statement\":\"...\"}]}",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Failed Big Thought:",
    `${input.failed.code}: ${input.failed.statement}`,
    "",
    "Big Thoughts that stay:",
    keeperLines,
    "",
    "Earlier failures. Do not repeat these sentences or this mistake:",
    lessonLines,
    ...openMistakeLines(
      lessons.map((lesson) => ({ reason: lesson.reason })),
      input.scope,
    ),
  ].join("\n");
}

export function parseBigThoughtFixStatement(script: string | null, parentStatement: string): string {
  if (!script?.trim()) return "";
  return parseGeneratedBigThoughts(parseModelJson(script), parentStatement)[0]?.statement.trim() ?? "";
}

async function askGate(input: {
  id: (typeof INDIVIDUAL_GATE_IDS)[number];
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string; label?: string }>;
  lessons?: Array<{ statement: string; reason: string }>;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<{ pass: boolean; reason: string }> {
  if (input.id === "duplicate") {
    const repeated = input.others.find((row) =>
      bigThoughtRepeats({ label: "", statement: input.statement }, { label: row.label, statement: row.statement }),
    );
    if (repeated) return { pass: false, reason: `Same Big Thought as ${repeated.code}.` };
    if (input.others.length === 0) return { pass: true, reason: "" };
  }
  const prompt = buildBigThoughtPassPrompt({
    id: input.id,
    statement: input.statement,
    parentStatement: input.parentStatement,
    others: input.others,
    lessons: input.lessons,
  });
  const script = await input.ask(prompt);
  const parsed = parseBigThoughtPassCheck(script);
  if (!parsed.pass && parsed.reason === UNDECIDED) {
    const again = await input.ask(prompt);
    return parseBigThoughtPassCheck(again);
  }
  return parsed;
}

function admissionItems(duplicate: PassGateCheck): PassGateCheck[] {
  return PASS_GATE_IDS.map((id) => {
    if (id === "duplicate") return duplicate;
    if (id === "resolved" || id === "relation") return { id, state: "pending" as const, reason: "" };
    return { id, state: "unchecked" as const, reason: "" };
  });
}

/** Exact copy or the same label. No model call, and the other generate checks stay unasked. */
export function generateDuplicateFailure(reason: string): PassChecklist {
  return admissionChecklist(
    PASS_GATE_IDS.map((id) => ({
      id,
      state: id === "duplicate" ? ("fail" as const) : ("unchecked" as const),
      reason: id === "duplicate" ? reason : "",
    })),
    { gate: "duplicate", phase: "checked", outcome: "fail" },
  );
}

/**
 * Generate checks the coarse duplicate before this runs.
 * Then one model call for a finished sentence, and one for a real reason.
 */
export async function runGenerateAdmissionChecks(input: {
  statement: string;
  parentStatement: string;
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<PassChecklist> {
  const items = admissionItems({ id: "duplicate", state: "pass", reason: "" });
  const publish = async (id: PassGateId, phase: "checking" | "checked", outcome: "pass" | "fail") => {
    await input.onStep?.(admissionChecklist(items, { gate: id, phase, outcome }));
  };
  await publish("duplicate", "checked", "pass");
  for (const id of ["resolved", "relation"] as const) {
    const index = items.findIndex((item) => item.id === id);
    items[index] = { id, state: "checking", reason: "" };
    await publish(id, "checking", "pass");
    const parsed = await askGate({
      id,
      statement: input.statement,
      parentStatement: input.parentStatement,
      others: [],
      ask: input.ask,
    });
    if (!parsed.pass) {
      items[index] = { id, state: "fail", reason: parsed.reason };
      for (const later of ["resolved", "relation"] as const) {
        const laterIndex = items.findIndex((item) => item.id === later);
        if (items[laterIndex]?.state === "pending") {
          items[laterIndex] = { id: later, state: "unchecked", reason: "" };
        }
      }
      const checklist = admissionChecklist(items, { gate: id, phase: "checked", outcome: "fail" });
      await input.onStep?.(checklist);
      return checklist;
    }
    items[index] = { id, state: "pass", reason: "" };
    await publish(id, "checked", "pass");
  }
  return admissionChecklist(items, { gate: "relation", phase: "checked", outcome: "pass" });
}

export function factsForGenerateAdmission(statement: string, checklist: PassChecklist): BigThoughtFacts {
  if (checklist.passed || !checklist.failure) {
    const facts = shownBigThoughtFacts("NEW", statement);
    const resolved = checklist.items.some((item) => item.id === "resolved" && item.state === "pass");
    const relation = checklist.items.some((item) => item.id === "relation" && item.state === "pass");
    if (resolved && relation) return { ...facts, generatePasses: ["resolved", "relation"] };
    return facts;
  }
  if (checklist.failure.gate === "duplicate") {
    return {
      ...shownBigThoughtFacts("NEW", statement),
      relationToParent: "DUPLICATE",
      supportRole: "UNRESOLVED",
      explainsWhyParentIsTrue: false,
    };
  }
  if (checklist.failure.gate === "relation") {
    return {
      ...shownBigThoughtFacts("NEW", statement),
      relationToParent: "RESTATEMENT",
      supportRole: "UNRESOLVED",
      explainsWhyParentIsTrue: false,
    };
  }
  return {
    ...shownBigThoughtFacts("NEW", statement),
    resolution: "UNRESOLVED",
    unresolvedReasons: [checklist.failure.reason],
  };
}

/** A rewritten sentence loses the two Generate passes. Checks that passed on this sentence stay. */
export function fixPriorForNextSentence(
  prior: readonly PassGateCheck[],
  previousStatement: string,
  nextStatement: string,
): PassGateCheck[] {
  const changed = previousStatement.trim().toLocaleLowerCase() !== nextStatement.trim().toLocaleLowerCase();
  return prior.map((item) =>
    changed && (item.id === "resolved" || item.id === "relation")
      ? { id: item.id, state: "pending", reason: "" }
      : { ...item },
  );
}

export async function runBigThoughtIndividualChecks(input: {
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string; label?: string }>;
  /** Generate passes for this exact sentence. Audit does not ask these again. */
  carried?: readonly GeneratePassGate[];
  /** Prior fix/audit failures for this card. Gate prompts keep only matching gate ids. */
  lessons?: Array<{ statement: string; reason: string }>;
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<PassChecklist> {
  const carried = new Set<GeneratePassGate>(input.carried ?? []);
  const items = emptyBigThoughtChecks().map((item) =>
    carried.has(item.id as GeneratePassGate) && (item.id === "resolved" || item.id === "relation")
      ? { id: item.id, state: "pass" as const, reason: "" }
      : item,
  );
  const publish = async (id: PassGateId, phase: "checking" | "checked", outcome: "pass" | "fail") => {
    await input.onStep?.(checklistFrom(items, { gate: id, phase, outcome }));
  };
  if (carried.size === 0) await input.onStep?.(checklistFrom(items));
  for (const id of INDIVIDUAL_GATE_IDS) {
    const index = items.findIndex((item) => item.id === id);
    if (items[index]?.state === "pass") continue;
    items[index] = { id, state: "checking", reason: "" };
    await publish(id, "checking", "pass");
    const parsed = await askGate({ ...input, id, lessons: input.lessons });
    if (!parsed.pass) {
      items[index] = { id, state: "fail", reason: parsed.reason };
      const checklist = checklistFrom(items, { gate: id, phase: "checked", outcome: "fail" });
      await input.onStep?.(checklist);
      return checklist;
    }
    items[index] = { id, state: "pass", reason: "" };
    await publish(id, "checked", "pass");
  }
  return checklistFrom(items, { gate: "premise", phase: "checked", outcome: "pass" });
}

/** Re-ask the checks that failed or have not run. A passed check stays passed. */
export async function runBigThoughtOpenChecks(input: {
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string; label?: string }>;
  prior: readonly PassGateCheck[];
  lessons?: Array<{ statement: string; reason: string }>;
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<PassChecklist> {
  const items = emptyBigThoughtChecks().map((item) => {
    const previous = input.prior.find((check) => check.id === item.id);
    return previous?.state === "pass" ? { id: item.id, state: "pass" as const, reason: "" } : { id: item.id, state: "pending" as const, reason: "" };
  });
  const publish = async (id: PassGateId, phase: "checking" | "checked", outcome: "pass" | "fail") => {
    await input.onStep?.(checklistFrom(items, { gate: id, phase, outcome }));
  };
  await input.onStep?.(checklistFrom(items));
  for (const id of INDIVIDUAL_GATE_IDS) {
    const index = items.findIndex((item) => item.id === id);
    if (items[index]?.state === "pass") continue;
    items[index] = { id, state: "checking", reason: "" };
    await publish(id, "checking", "pass");
    const parsed = await askGate({ ...input, id, lessons: input.lessons });
    if (!parsed.pass) {
      items[index] = { id, state: "fail", reason: parsed.reason };
      const checklist = checklistFrom(items, { gate: id, phase: "checked", outcome: "fail" });
      await input.onStep?.(checklist);
      return checklist;
    }
    items[index] = { id, state: "pass", reason: "" };
    await publish(id, "checked", "pass");
  }
  return checklistFrom(items, { gate: "premise", phase: "checked", outcome: "pass" });
}
