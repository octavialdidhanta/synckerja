import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { fixScopeLines, type FixScope } from "@/thinking-lab/shared/fixScope";
import { chainNarrationLines, conclusionNarrationLines, type VoiceOverScript } from "@/thinking-lab/execution/script";
import {
  isFailedMeaningAudit,
  isFlashSalePillar,
  type ExecutionAuditLesson,
  type ExecutionMeaningAudit,
  type ExecutionPassCheckId,
  type ExecutionRelation,
  type ExecutionSemanticFacts,
  type ExecutionSubjectMatch,
  type ExecutionTriState,
  type ExecutionViewerClimb,
} from "@/thinking-lab/execution/types";

export const EXECUTION_PASS_CHECK_IDS = [
  "pillarFits",
  "sellingFits",
  "mechanismVisible",
  "messageStays",
  "causeChain",
  "viewerClimb",
  "subjectMatch",
  "conclusionLands",
] as const satisfies readonly ExecutionPassCheckId[];

const LINE_CHECK_IDS = ["messageStays", "causeChain", "viewerClimb", "conclusionLands"] as const satisfies readonly ExecutionPassCheckId[];

export const EXECUTION_LINE_REPAIR_IDS = [
  "messageStays",
  "causeChain",
  "viewerClimb",
  "subjectMatch",
  "conclusionLands",
] as const satisfies readonly ExecutionPassCheckId[];

export type ExecutionPassCheckState = "pending" | "running" | "pass" | "fail";

export type ExecutionPassCheck = {
  id: ExecutionPassCheckId;
  state: ExecutionPassCheckState;
  reason?: string;
  lineIds?: string[];
};

const UNDECIDED = "This check could not be decided.";
const MISSING_SUBJECT = "The Master Thought subject was not named.";
const FLASH_SALE_REASON = "Flash Sale Hook needs a Master Thought that is actually selling.";

const RELATIONS: Record<ExecutionPassCheckId, ExecutionRelation> = {
  pillarFits: "PILLAR_OUTSIDE",
  sellingFits: "PILLAR_NOT_SELLING",
  mechanismVisible: "MECHANISM_HIDDEN",
  messageStays: "MESSAGE_ADDED",
  causeChain: "CAUSE_BROKEN",
  viewerClimb: "CLIMB_MISSED",
  subjectMatch: "SUBJECT_MISMATCH",
  conclusionLands: "CONCLUSION_MISSED",
};

export function emptyExecutionPassChecklist(): ExecutionPassCheck[] {
  return EXECUTION_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

export function meaningLineRepairReady(facts: ExecutionSemanticFacts): boolean {
  const audit = facts.meaningAudit;
  if (!isFailedMeaningAudit(audit)) return false;
  return EXECUTION_LINE_REPAIR_IDS.some((id) => id === audit.id) && audit.lineIds.length > 0;
}

export function executionChecklistPassed(facts: ExecutionSemanticFacts, admission: string, lineIssueCount: number): boolean {
  if (facts.meaningAudit) return facts.relationToParent === "VALID_EXECUTION";
  return admission === "GENERATE_VALID" && lineIssueCount === 0;
}

function knownIds(lines: Array<{ id: string }>): Set<string> {
  return new Set(lines.map((line) => line.id));
}

function lineBlock(lines: Array<{ id: string; narration: string }>): string[] {
  if (lines.length === 0) return ["(none)"];
  return lines.map((line) => `${line.id}: ${line.narration.trim()}`);
}

export function buildExecutionPassPrompt(input: {
  id: ExecutionPassCheckId;
  pillar: string;
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  lines: Array<{ id: string; narration: string }>;
}): string {
  const rule =
    input.id === "pillarFits"
      ? [
          "pass is true only when this pillar realizes the Idea and does not force a message the Idea does not contain.",
          "pass is false when the pillar forces a message outside the Idea.",
        ]
      : input.id === "mechanismVisible"
        ? [
            "pass is true when a viewer can see the Idea's mechanism in this script.",
            "pass is false only when the format hides the mechanism.",
            "A mechanism that is merely unstated in the lines is not a format failure, so pass stays true.",
          ]
        : input.id === "messageStays"
          ? [
              "pass is true when every listed line keeps the Idea's message and adds no claim the Idea does not carry.",
              "pass is false when a line adds a claim or drops the Idea's message.",
              "Name each failing line id.",
            ]
          : input.id === "causeChain"
            ? [
                "pass is true when the cause is the Big Thought's stake, and that stake moves the Master Thought's outcome.",
                "pass is false when a line installs another cause, including an advertisement.",
                "Name each failing line id.",
              ]
            : input.id === "viewerClimb"
              ? [
                  "pass is true when a viewer of the whole voice-over climbs from the Idea's mechanism to the Master Thought statement.",
                  "pass is false when the viewer reaches another conclusion or an unwanted negative conclusion.",
                  "A missing Master Thought subject name is not a reason to return unresolved. Judge the climb against the Master Thought statement.",
                  "The content does not have to say the subject's name.",
                  "Name each failing line id.",
                ]
              : input.id === "subjectMatch"
                ? [
                    "pass is true when the Master Thought the viewer reaches is about the named subject.",
                    "pass is false when it is about a different subject.",
                    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
                    "Name each failing line id.",
                  ]
                : [
                    "These lines are the conclusion. The call to action is not here.",
                    "pass is true when a viewer who hears only these lines can say the Master Thought.",
                    "Saying the Master Thought in the situation's words passes. Pasting it unchanged as a slogan is not required.",
                    "pass is false when these lines only restate the mechanism, hide the Master Thought, or announce another cause.",
                    "Name each failing line id.",
                  ];
  return [
    "Decide one Execution pass check. Do not rewrite the script.",
    ...rule,
    "When pass is false, reason says why in the same language as the Idea.",
    "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":"","lineIds":[]} or {"pass":false,"reason":"...","lineIds":["..."]}',
    "",
    `Pillar: ${input.pillar.trim()}`,
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Lines:",
    ...lineBlock(input.lines),
  ].join("\n");
}

export function parseExecutionPassCheck(
  script: string | null,
  known: ReadonlySet<string>,
): { pass: boolean; reason: string; lineIds: string[] } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED, lineIds: [] };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED, lineIds: [] };
  const row = parsed as { pass?: unknown; reason?: unknown; lineIds?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  const lineIds = Array.isArray(row.lineIds)
    ? row.lineIds.flatMap((item) => {
        const id = typeof item === "string" ? item.trim() : "";
        return id && known.has(id) ? [id] : [];
      })
    : [];
  if (row.pass === true) return { pass: true, reason: "", lineIds: [] };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED, lineIds };
  return { pass: false, reason: UNDECIDED, lineIds: [] };
}

function linesFor(
  id: ExecutionPassCheckId,
  script: VoiceOverScript,
): Array<{ id: string; narration: string }> {
  if (id === "conclusionLands") return conclusionNarrationLines(script);
  if (id === "pillarFits" || id === "mechanismVisible" || id === "sellingFits") {
    return chainNarrationLines(script);
  }
  return chainNarrationLines(script);
}

function needsLineIds(id: ExecutionPassCheckId): boolean {
  return LINE_CHECK_IDS.some((item) => item === id) || id === "subjectMatch";
}

export function executionFactsFromChecks(input: {
  pillar: string;
  checks: readonly ExecutionPassCheck[];
  masterSells: ExecutionTriState;
  auditLessons?: ExecutionAuditLesson[];
}): ExecutionSemanticFacts {
  const fields: {
    messageAdded: ExecutionTriState;
    mechanismVisible: ExecutionTriState;
    pillarOutside: ExecutionTriState;
    masterSells: ExecutionTriState;
    viewerClimb: ExecutionViewerClimb;
    subjectMatch: ExecutionSubjectMatch;
  } = {
    messageAdded: "unresolved",
    mechanismVisible: "unresolved",
    pillarOutside: "unresolved",
    masterSells: input.masterSells,
    viewerClimb: "UNRESOLVED",
    subjectMatch: "UNRESOLVED",
  };
  for (const check of input.checks) {
    if (check.state !== "pass" && check.state !== "fail") break;
    const undecided = check.state === "fail" && check.reason === UNDECIDED;
    if (check.id === "pillarFits" && !undecided) fields.pillarOutside = check.state === "pass" ? false : true;
    if (check.id === "sellingFits") {
      if (check.state === "pass" && isFlashSalePillar(input.pillar)) fields.masterSells = true;
      if (check.state === "fail" && check.reason === FLASH_SALE_REASON) fields.masterSells = false;
      if (undecided) fields.masterSells = "unresolved";
    }
    if (check.id === "mechanismVisible" && !undecided) fields.mechanismVisible = check.state === "pass" ? true : false;
    if (check.id === "messageStays" && !undecided) fields.messageAdded = check.state === "pass" ? false : true;
    if (check.id === "viewerClimb" && !undecided) fields.viewerClimb = check.state === "pass" ? "CLIMBS" : "OTHER";
    if (check.id === "subjectMatch" && !undecided) {
      fields.subjectMatch = check.state === "pass" ? "MATCH" : check.reason === MISSING_SUBJECT ? "UNRESOLVED" : "OTHER";
    }
    if (check.state === "fail") break;
  }
  const failed = input.checks.find((check) => check.state === "fail");
  const undecided = failed?.reason === UNDECIDED;
  const relation: ExecutionRelation = !failed ? "VALID_EXECUTION" : undecided ? "UNRESOLVED" : RELATIONS[failed.id];
  const meaningAudit: ExecutionMeaningAudit = !failed
    ? { cleared: true }
    : { id: failed.id, reason: failed.reason ?? UNDECIDED, lineIds: failed.lineIds ?? [] };
  return {
    pillar: input.pillar,
    whatItSays: failed?.reason ?? "",
    relationToParent: relation,
    messageAdded: fields.messageAdded,
    mechanismVisible: fields.mechanismVisible,
    pillarOutside: fields.pillarOutside,
    masterSells: fields.masterSells,
    viewerClimb: fields.viewerClimb,
    subjectMatch: fields.subjectMatch,
    resolution: relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED",
    unresolvedReasons:
      relation === "UNRESOLVED" ? [failed?.id === "sellingFits" ? "MASTER_SELLS_UNRESOLVED" : "CHECK_UNDECIDED"] : [],
    meaningAudit,
    auditLessons: input.auditLessons ?? [],
  };
}

export async function runExecutionMeaningChecks(input: {
  pillar: string;
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  script: VoiceOverScript;
  masterSells: true | false | "unresolved" | "unknown";
  auditLessons?: ExecutionAuditLesson[];
  ask: (prompt: string) => Promise<string | null>;
  resolveSelling?: () => Promise<true | false | "unresolved">;
  onStep: (checks: ExecutionPassCheck[]) => void;
}): Promise<{ checks: ExecutionPassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  const checks = emptyExecutionPassChecklist();
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  let masterSells: ExecutionTriState = input.masterSells === "unknown" ? "unresolved" : input.masterSells;
  publish();
  for (const id of EXECUTION_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    checks[index] = { id, state: "running" };
    publish();
    if (id === "sellingFits") {
      if (!isFlashSalePillar(input.pillar)) {
        checks[index] = { id, state: "pass" };
        publish();
        continue;
      }
      const asked =
        input.masterSells === "unknown" ? ((await input.resolveSelling?.()) ?? "unresolved") : input.masterSells;
      const selling = asked === true || asked === false ? asked : "unresolved";
      masterSells = selling;
      if (selling === true) {
        checks[index] = { id, state: "pass" };
        publish();
        continue;
      }
      checks[index] = {
        id,
        state: "fail",
        reason: selling === false ? FLASH_SALE_REASON : UNDECIDED,
        lineIds: [],
      };
      publish();
      break;
    }
    if (id === "subjectMatch" && !input.masterSubject?.trim()) {
      checks[index] = { id, state: "fail", reason: MISSING_SUBJECT, lineIds: [] };
      publish();
      break;
    }
    const lines = linesFor(id, input.script);
    const known = knownIds(lines);
    const parsed = parseExecutionPassCheck(
      await input.ask(
        buildExecutionPassPrompt({
          id,
          pillar: input.pillar,
          masterStatement: input.masterStatement,
          masterSubject: input.masterSubject,
          ideaStatement: input.ideaStatement,
          ancestors: input.ancestors,
          lines,
        }),
      ),
      known,
    );
    if (!parsed.pass) {
      const lineIds = needsLineIds(id) ? parsed.lineIds : [];
      const undecided = needsLineIds(id) && lineIds.length === 0;
      checks[index] = {
        id,
        state: "fail",
        reason: undecided ? UNDECIDED : parsed.reason,
        lineIds: undecided ? [] : lineIds,
      };
      publish();
      break;
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  const facts = executionFactsFromChecks({
    pillar: input.pillar,
    checks,
    masterSells,
    auditLessons: input.auditLessons,
  });
  return { checks: checks.map((check) => ({ ...check })), passed: facts.relationToParent === "VALID_EXECUTION", facts };
}

/** The checks implied by a stored audit. Everything before the first failure already passed. */
export function executionChecksFromAudit(audit: ExecutionMeaningAudit | null | undefined): ExecutionPassCheck[] {
  if (audit && "cleared" in audit) return EXECUTION_PASS_CHECK_IDS.map((id) => ({ id, state: "pass" }));
  if (!isFailedMeaningAudit(audit)) return emptyExecutionPassChecklist();
  const failedAt = EXECUTION_PASS_CHECK_IDS.indexOf(audit.id);
  return EXECUTION_PASS_CHECK_IDS.map((id, index) => {
    if (failedAt >= 0 && index < failedAt) return { id, state: "pass" };
    if (id === audit.id) return { id, state: "fail", reason: audit.reason, lineIds: audit.lineIds };
    return { id, state: "pending" };
  });
}

/** The red check moved later, so the rewritten lines cleared the check that started this click. */
export function executionFailureMoved(before: ExecutionPassCheckId, checks: readonly ExecutionPassCheck[]): boolean {
  const next = checks.find((check) => check.state === "fail");
  if (!next) return false;
  return EXECUTION_PASS_CHECK_IDS.indexOf(next.id) > EXECUTION_PASS_CHECK_IDS.indexOf(before);
}

/** Re-ask the checks that failed or have not run. Checks that already passed stay passed. */
export async function runExecutionOpenChecks(input: {
  pillar: string;
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  script: VoiceOverScript;
  masterSells: true | false | "unresolved" | "unknown";
  auditLessons?: ExecutionAuditLesson[];
  prior: readonly ExecutionPassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  resolveSelling?: () => Promise<true | false | "unresolved">;
  onStep: (checks: ExecutionPassCheck[]) => void;
}): Promise<{ checks: ExecutionPassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  const checks = emptyExecutionPassChecklist().map((check) => {
    const previous = input.prior.find((item) => item.id === check.id);
    return previous?.state === "pass" ? { id: check.id, state: "pass" as const } : { id: check.id, state: "pending" as const };
  });
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  let masterSells: ExecutionTriState = input.masterSells === "unknown" ? "unresolved" : input.masterSells;
  publish();
  for (const id of EXECUTION_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "sellingFits") {
      if (!isFlashSalePillar(input.pillar)) {
        checks[index] = { id, state: "pass" };
        publish();
        continue;
      }
      const asked =
        input.masterSells === "unknown" ? ((await input.resolveSelling?.()) ?? "unresolved") : input.masterSells;
      const selling = asked === true || asked === false ? asked : "unresolved";
      masterSells = selling;
      if (selling === true) {
        checks[index] = { id, state: "pass" };
        publish();
        continue;
      }
      checks[index] = {
        id,
        state: "fail",
        reason: selling === false ? FLASH_SALE_REASON : UNDECIDED,
        lineIds: [],
      };
      publish();
      break;
    }
    if (id === "subjectMatch" && !input.masterSubject?.trim()) {
      checks[index] = { id, state: "fail", reason: MISSING_SUBJECT, lineIds: [] };
      publish();
      break;
    }
    const lines = linesFor(id, input.script);
    const known = knownIds(lines);
    const parsed = parseExecutionPassCheck(
      await input.ask(
        buildExecutionPassPrompt({
          id,
          pillar: input.pillar,
          masterStatement: input.masterStatement,
          masterSubject: input.masterSubject,
          ideaStatement: input.ideaStatement,
          ancestors: input.ancestors,
          lines,
        }),
      ),
      known,
    );
    if (!parsed.pass) {
      const lineIds = needsLineIds(id) ? parsed.lineIds : [];
      const undecided = needsLineIds(id) && lineIds.length === 0;
      checks[index] = {
        id,
        state: "fail",
        reason: undecided ? UNDECIDED : parsed.reason,
        lineIds: undecided ? [] : lineIds,
      };
      publish();
      break;
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  const facts = executionFactsFromChecks({
    pillar: input.pillar,
    checks,
    masterSells,
    auditLessons: input.auditLessons,
  });
  return { checks: checks.map((check) => ({ ...check })), passed: facts.relationToParent === "VALID_EXECUTION", facts };
}

export function mergeExecutionAuditLessons(
  existing: readonly ExecutionAuditLesson[],
  next: readonly ExecutionAuditLesson[],
): ExecutionAuditLesson[] {
  const seen = new Set(existing.map((lesson) => `${lesson.checkId}\n${lesson.reason}\n${lesson.lines.join("\n")}`));
  const merged = [...existing];
  for (const lesson of next) {
    const key = `${lesson.checkId}\n${lesson.reason}\n${lesson.lines.join("\n")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(lesson);
  }
  return merged;
}

export function lessonFromMeaningAudit(facts: ExecutionSemanticFacts, script: VoiceOverScript): ExecutionAuditLesson | null {
  const audit = facts.meaningAudit;
  if (!isFailedMeaningAudit(audit)) return null;
  const narrations = new Map(
    script.scenes.flatMap((scene) => scene.lines.map((line) => [line.id, line.narration.trim()] as const)),
  );
  return {
    checkId: audit.id,
    reason: audit.reason,
    lines: audit.lineIds.flatMap((id) => {
      const narration = narrations.get(id);
      return narration ? [narration] : [];
    }),
  };
}

export function buildExecutionMeaningRepairPrompt(input: {
  ideaStatement: string;
  masterStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  pillarName: string;
  checkId: ExecutionPassCheckId;
  reason: string;
  script: VoiceOverScript;
  lineIds: string[];
  lessons: ExecutionAuditLesson[];
  scope?: FixScope;
}): string {
  const failing = new Set(input.lineIds);
  const openLessons = input.lessons.filter((lesson) => !input.scope?.preserve.includes(lesson.checkId));
  const lessonLines =
    openLessons.length === 0
      ? "(none)"
      : openLessons
          .map((lesson) => `${lesson.checkId}: ${lesson.lines.join(" / ")}\nWhy it failed: ${lesson.reason}`)
          .join("\n");
  return [
    "Propose one narration replacement for each failing line.",
    "Change only the narration. Do not change shots, the call to action, the brand name, the duration, the point of view, or the locked decisions.",
    "Do not repeat a narration listed under the earlier failures, and do not repeat the same mistake.",
    `This failure is ${input.checkId}: ${input.reason}`,
    "Saying the Master Thought in the situation's words passes. Do not paste it unchanged as a slogan.",
    ...fixScopeLines(input.scope ?? { preserve: [], repair: [{ id: input.checkId, reason: input.reason }] }),
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\"}]}",
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...(input.masterSubject?.trim() ? ["", `Master Thought subject: ${input.masterSubject.trim()}`] : []),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    `Pillar: ${input.pillarName}`,
    "",
    "Earlier failures. Do not repeat these narrations or this mistake:",
    lessonLines,
    "",
    "Failing lines:",
    ...input.script.scenes.flatMap((scene) =>
      scene.lines
        .filter((line) => failing.has(line.id))
        .map((line) => `${line.id}: ${line.narration.trim()}`),
    ),
  ].join("\n");
}

export function parseExecutionNarrationReplacements(raw: unknown): Array<{ lineId: string; narration: string }> {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { lines?: unknown }).lines : raw;
  if (!Array.isArray(row)) return [];
  return row.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const line = item as { lineId?: unknown; id?: unknown; narration?: unknown };
    const lineId = typeof line.lineId === "string" ? line.lineId.trim() : typeof line.id === "string" ? line.id.trim() : "";
    const narration = typeof line.narration === "string" ? line.narration.trim() : "";
    if (!lineId || !narration) return [];
    return [{ lineId, narration }];
  });
}
