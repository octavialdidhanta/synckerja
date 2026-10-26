import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { fixScopeLines, type FixScope } from "@/thinking-lab/shared/fixScope";
import { claimMaterialLines, pillarDevelopmentLines } from "@/thinking-lab/execution/confirm";
import { chainNarrationLines, mergeNarrationRepairs, type VoiceOverScript } from "@/thinking-lab/execution/script";
import {
  isFailedMeaningAudit,
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
  "hookHolds",
  "soundsSpoken",
  "usesSlang",
  "pillarFits",
  "formatHolds",
  "mechanismVisible",
  "messageStays",
  "causeChain",
  "viewerClimb",
  "emotionalTone",
] as const satisfies readonly ExecutionPassCheckId[];

const LINE_CHECK_IDS = ["soundsSpoken", "usesSlang", "messageStays", "causeChain", "viewerClimb", "emotionalTone"] as const satisfies readonly ExecutionPassCheckId[];

/** A new video starts with every requirement switched off. */
function videoCheckOnByDefault(_id: ExecutionPassCheckId): boolean {
  return false;
}

export const EXECUTION_LINE_REPAIR_IDS = [
  "hookHolds",
  "soundsSpoken",
  "usesSlang",
  "formatHolds",
  "messageStays",
  "causeChain",
  "viewerClimb",
  "emotionalTone",
] as const satisfies readonly ExecutionPassCheckId[];

export type ExecutionPassCheckState = "pending" | "running" | "pass" | "fail";

export type ExecutionPassCheck = {
  id: ExecutionPassCheckId;
  state: ExecutionPassCheckState;
  enabled?: boolean;
  reason?: string;
  lineIds?: string[];
};

const UNDECIDED = "This check could not be decided.";
const MISSING_OPENING = "The first narration sentence is missing.";

/** Industry-free speech rules. The same four rules judge video lines and image slides. */
export function everydaySpeechJudgeRules(surface: "video" | "image"): string[] {
  return [
    surface === "image"
      ? "One slide may hold more than one short sentence about the same thing. The following sentence shows that thing through what a person does."
      : "One narration line may be two short sentences about the same thing. The following sentence shows that thing through what a person does.",
    "pass is false when the following sentence explains, defines, or interprets the sign.",
    "pass is false when a sentence only names a result that cannot be pointed at.",
    "pass is false when the sentence only evaluates the point or announces the speaker's method of looking.",
    "Stating the Idea can pass. pass is false when the sentence sounds like a presentation: it tells how important the point is, or it names a condition with a formal noun, and no person is doing something.",
    "Naming a product the Idea already carries can pass.",
    "pass is false when any spoken line is a formal address or a list of what a product can do.",
    surface === "image" ? "An invitation on a slide is one spoken invitation." : "The call to action is one spoken invitation.",
    "pass is false when an invitation is a written instruction.",
    surface === "image"
      ? "The pillar name may stay in the slide title. The narration uses everyday words for that same shape."
      : "The pillar name may stay in the scene title. The spoken line uses everyday words for that same shape.",
    "pass is false when the spoken line uses the pillar's name instead of everyday words for that shape.",
    "A calm sentence still fails when it reads like a report.",
  ];
}

export function everydaySpeechWriterRules(surface: "video" | "image"): string[] {
  return [
    surface === "image"
      ? "The sentences on a slide stay about the same thing. A following sentence shows that thing through what a person does."
      : "One narration line may be two short sentences about the same thing. The following sentence shows that thing through what a person does.",
    "Do not explain, define, or interpret the sign in the following sentence.",
    "Do not leave a sentence that only names a result that cannot be pointed at.",
    "Tell what happens. Do not evaluate the point or announce the speaker's method of looking.",
    "State the Idea in everyday speech. Do not write a presentation, tell how important the point is, or name a condition with a formal noun when no person is doing something.",
    "A product the Idea already carries may be named. Do not write a formal address or a list of what a product can do in any spoken line.",
    surface === "image" ? "An invitation on a slide is one spoken invitation." : "The call to action is one spoken invitation.",
    "Do not write an invitation as a written instruction.",
    surface === "image"
      ? "The pillar name may stay in the slide title. Use everyday words for that same shape inside the narration."
      : "The pillar name may stay in the scene title. Use everyday words for that same shape inside the narration.",
    "Do not write a calm report.",
  ];
}

/** Slang is a register inside everyday speech. It stays off until its switch is on. */
export function slangWriterRules(): string[] {
  return [
    "Write every spoken line in slang the audience would actually say.",
    "Use the short spoken forms of the Idea's language.",
    "In Indonesian, nggak, sih, deh, kok, dong, aja, and banget can carry that slang when the line needs them.",
    "Do not write a formal connector such as tidak, sangat, namun, merupakan, or oleh karena itu.",
    "Talk the way this speaker talks to someone close. Do not write a formal address.",
    "Keep the line clear. Do not pile on abbreviations the audience would not say.",
    "Slang changes the wording. Keep the step the locked pillar communication already wrote.",
  ];
}

export function slangJudgeRules(): string[] {
  return [
    "pass is true when the line uses slang the audience would actually say out loud.",
    "The short spoken forms of the Idea's language count. In Indonesian, nggak, sih, deh, kok, dong, aja, and banget can be that slang.",
    "pass is false when the line uses a formal connector such as tidak, sangat, namun, merupakan, or oleh karena itu.",
    "pass is false when the line is a formal address instead of the way this speaker talks to someone close.",
    "pass is false when the line piles on abbreviations the audience would not say.",
    "A clear line can pass. Slang does not have to be obscure.",
    "Do not fail because the line is calm, because it states the Idea, or because it follows this pillar's format.",
    "Do not fail because the line adds a claim. Another check judges that.",
    "Slang changes the wording. The step the locked pillar communication already wrote stays.",
  ];
}

const RELATIONS: Record<ExecutionPassCheckId, ExecutionRelation> = {
  hookHolds: "HOOK_MISSED",
  soundsSpoken: "SPEECH_STIFF",
  usesSlang: "SLANG_MISSED",
  pillarFits: "PILLAR_OUTSIDE",
  formatHolds: "FORMAT_MISSED",
  mechanismVisible: "MECHANISM_HIDDEN",
  messageStays: "MESSAGE_ADDED",
  causeChain: "CAUSE_BROKEN",
  viewerClimb: "CLIMB_MISSED",
  emotionalTone: "PERSON_MISSED",
  imageShape: "FORMAT_MISSED",
  imageCopy: "FORMAT_MISSED",
  imagePrompt: "FORMAT_MISSED",
  imageCaption: "FORMAT_MISSED",
};

export function emptyExecutionPassChecklist(): ExecutionPassCheck[] {
  return EXECUTION_PASS_CHECK_IDS.map((id) =>
    videoCheckOnByDefault(id) ? { id, state: "pending", enabled: true } : { id, state: "pass", enabled: false },
  );
}

/** Switches already chosen stay. A missing switch uses the video default. Passed switches stay passed unless this run starts them over. */
function checklistWithPrior(prior: readonly ExecutionPassCheck[] | undefined, rerunPassed: boolean): ExecutionPassCheck[] {
  return emptyExecutionPassChecklist().map((check) => {
    const previous = prior?.find((item) => item.id === check.id);
    if (!previous) return { ...check };
    if (previous.enabled === false) return { id: check.id, state: "pass", enabled: false };
    if (!rerunPassed && previous.state === "pass") return { id: check.id, state: "pass", enabled: true };
    return { id: check.id, state: "pending", enabled: true };
  });
}

export function meaningLineRepairReady(facts: ExecutionSemanticFacts): boolean {
  const audit = facts.meaningAudit;
  if (!isFailedMeaningAudit(audit)) return false;
  return EXECUTION_LINE_REPAIR_IDS.some((id) => id === audit.id) && audit.lineIds.length > 0;
}

export function executionChecklistPassed(facts: ExecutionSemanticFacts, admission: string, lineIssueCount: number): boolean {
  if (facts.passChecks && facts.passChecks.length > 0) {
    return facts.passChecks.every((check) => check.enabled === false || check.state === "pass");
  }
  if (facts.meaningAudit) return facts.relationToParent === "VALID_EXECUTION";
  return admission === "GENERATE_VALID" && lineIssueCount === 0;
}

export function storedPassChecks(checks: readonly ExecutionPassCheck[]): ExecutionSemanticFacts["passChecks"] {
  return checks.map((check) => {
    const enabled = check.enabled !== false;
    const state = !enabled ? "pass" : check.state === "running" ? "pending" : check.state;
    return {
      id: check.id,
      enabled,
      state,
      ...(enabled && state === "fail" && check.reason ? { reason: check.reason } : {}),
      ...(enabled && state === "fail" && check.lineIds && check.lineIds.length > 0 ? { lineIds: check.lineIds } : {}),
    };
  });
}

export function checksImplementedBySwitch(checks: readonly ExecutionPassCheck[]): ExecutionPassCheck[] {
  return checks.map((check) =>
    check.enabled === false
      ? { id: check.id, state: "pass", enabled: false }
      : { id: check.id, state: "pass", enabled: true },
  );
}

export function togglePassCheck(
  checks: readonly ExecutionPassCheck[],
  id: string,
  enabled: boolean,
): { checks: ExecutionPassCheck[]; audit: boolean } {
  if (!checks.some((check) => check.id === id)) return { checks: checks.map((check) => ({ ...check })), audit: false };
  const next = checks.map((check) => {
    if (check.id !== id) return { ...check };
    if (!enabled) return { id: check.id, state: "pass" as const, enabled: false };
    return { id: check.id, state: "pending" as const, enabled: true };
  });
  const audit = enabled && next.every((check) => check.id === id || check.enabled === false || check.state === "pass");
  return { checks: next, audit };
}

/** A stored checklist keeps its switches. A requirement added later starts off. */
export function ensureVideoPassChecks(checks: readonly ExecutionPassCheck[]): ExecutionPassCheck[] {
  if (checks.length === 0) return [];
  return EXECUTION_PASS_CHECK_IDS.reduce<ExecutionPassCheck[]>(
    (rows, id) => (rows.some((check) => check.id === id) ? rows : insertPassCheck(rows, { id, state: "pass", enabled: false })),
    checks.map((check) => ({ ...check })),
  );
}

/** The switches as they are now. A new script re-runs every switch that is On and keeps every switch that is Off. */
export function regeneratePassPrior(checks: readonly ExecutionPassCheck[]): ExecutionPassCheck[] {
  const source = checks.some((check) => check.id === "emotionalTone")
    ? checks.map((check) => ({ ...check }))
    : insertPassCheck(checks, { id: "emotionalTone", state: "pass", enabled: false });
  return source.map((check) =>
    check.enabled === false
      ? { id: check.id, state: "pass" as const, enabled: false }
      : { id: check.id, state: "pending" as const, enabled: true },
  );
}

function insertPassCheck(checks: readonly ExecutionPassCheck[], added: ExecutionPassCheck): ExecutionPassCheck[] {
  const at = EXECUTION_PASS_CHECK_IDS.indexOf(added.id as (typeof EXECUTION_PASS_CHECK_IDS)[number]);
  let insertAt = checks.length;
  for (let index = 0; index < checks.length; index += 1) {
    const position = EXECUTION_PASS_CHECK_IDS.indexOf(checks[index]?.id as (typeof EXECUTION_PASS_CHECK_IDS)[number]);
    if (position > at) {
      insertAt = index;
      break;
    }
  }
  return [...checks.slice(0, insertAt).map((check) => ({ ...check })), added, ...checks.slice(insertAt).map((check) => ({ ...check }))];
}

export function openPassResume(checks: readonly ExecutionPassCheck[]): boolean {
  const active = checks.filter((check) => check.enabled !== false);
  return active.some((check) => check.state === "pass") && active.some((check) => check.state === "pending") && !active.some((check) => check.state === "fail");
}

export function factsForPassChecks(previous: ExecutionSemanticFacts, checks: readonly ExecutionPassCheck[]): ExecutionSemanticFacts {
  const passChecks = storedPassChecks(checks);
  const active = checks.filter((check) => check.enabled !== false);
  const failed = active.find((check) => check.state === "fail");
  const waiting = active.some((check) => check.state === "pending" || check.state === "running");
  const messageAdded: ExecutionTriState = active.some((check) => check.id === "messageStays" && check.state === "fail")
    ? true
    : active.some((check) => check.id === "messageStays" && check.state === "pass")
      ? false
      : previous.messageAdded;
  if (failed) {
    const undecided = failed.reason === UNDECIDED;
    const relation: ExecutionRelation = undecided ? "UNRESOLVED" : RELATIONS[failed.id];
    return {
      ...previous,
      messageAdded,
      whatItSays: failed.reason ?? "",
      relationToParent: relation,
      resolution: relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED",
      unresolvedReasons: relation === "UNRESOLVED" ? ["CHECK_UNDECIDED"] : [],
      meaningAudit: { id: failed.id, reason: failed.reason ?? UNDECIDED, lineIds: failed.lineIds ?? [] },
      passChecks,
    };
  }
  if (waiting) {
    const { meaningAudit: _audit, ...rest } = previous;
    return {
      ...rest,
      messageAdded,
      whatItSays: "",
      relationToParent: "UNRESOLVED",
      resolution: "UNRESOLVED",
      unresolvedReasons: ["PASS_CHECK_PENDING"],
      passChecks,
    };
  }
  return {
    ...previous,
    messageAdded,
    whatItSays: "",
    relationToParent: "VALID_EXECUTION",
    resolution: "RESOLVED",
    unresolvedReasons: [],
    meaningAudit: { cleared: true },
    passChecks,
  };
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
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  decisions?: VoiceOverScript["decisions"];
  lines: Array<{ id: string; narration: string }>;
}): string {
  const rule =
    input.id === "hookHolds"
      ? [
          "This line is the first narration sentence of the first story scene.",
          "Title, caption, later sentences, the conclusion, and the call to action are not this check.",
          "pass is true only when a stranger who hears only this sentence can tell what situation they are in.",
          "The sentence uses this pillar's format.",
          "Use the pillar name, category, and description. A list format opens as a list. A story format opens as a story.",
          "A question or a what-if can pass only when that shape is this pillar's format. Do not require one.",
          "The problem is not answered yet.",
          "The problem is the one running from the Master Thought through the Big Thought, Territory, and Angle into this Idea. Do not invent a sharper problem.",
          "pass is false when the sentence would still make sense if that problem were removed.",
          "pass is false when the opening uses a different format from the pillar.",
          "pass is false when it is a sales question such as tahu nggak, did you know, or pernah merasa, and that question is not this pillar's format.",
          "pass is false when it is a greeting, a pillar label, a number, the brand name, or the conclusion.",
          "Name the failing line id.",
        ]
      : input.id === "soundsSpoken"
        ? [
            "These are the spoken narration lines.",
            "pass is true when a stranger who does not work in this field can read the line out loud and it still sounds like someone talking.",
            "Everyday words are enough. The line does not need this field's special terms.",
            ...everydaySpeechJudgeRules("video"),
            "pass is false when the line reads like a report, a definition, or a brochure.",
            "pass is false when a stranger outside this field must know this field's special terms to understand it.",
            "The pillar's list or story shape can stay. The wording of that line still has to be everyday speech.",
            "Do not fail because the line follows this pillar's shape. The pillar's name inside the spoken line is not that shape.",
            "Do not fail because the person has not appeared yet. Another check judges that.",
            "Do not fail because the line adds a claim. Another check judges that.",
            "Name the line id that fails.",
          ]
        : input.id === "usesSlang"
          ? [
              "These are the spoken narration lines.",
              ...slangJudgeRules(),
              "Name the line id that fails.",
            ]
          : input.id === "pillarFits"
      ? [
          "This check judges the pillar format. A sentence that can be rewritten is not this check.",
          "pass is true when this format can realize the Idea without forcing a message the Idea does not contain.",
          "A line that adds a solution can be rewritten later. Do not fail this check for that line.",
          "pass is false only when the format itself cannot carry the Idea unless it adds a message the Idea does not contain.",
        ]
      : input.id === "formatHolds"
        ? [
            "These lines are the story. The call to action is not here.",
            "The pillar is a format. The spoken lines must be written in that format.",
            "Use the pillar name, category, and description. A list format is a list. A story format is a story. Do not swap them.",
            "A list is distinct items. Each spoken item says a different part of the Idea.",
            "pass is true only when these spoken lines are that format, each list item says a different part, and the lines still carry this Idea.",
            "pass is false when the lines use another format.",
            "pass is false when list items repeat one point in new words.",
            "The format's opening word may stay the same. Do not fail only because every item starts with that word.",
            "pass is false when the format appears only in a scene title and the spoken lines do something else.",
            "Do not fail this check only because the pillar adds a new message. That is a different check.",
            "Name each line that is not in the format.",
            'When the failure is a repeated point, return {"pass":false,"reason":"...","lineIds":[],"repeat":true}.',
          ]
        : input.id === "mechanismVisible"
        ? [
            "pass is false only when the format hides the mechanism.",
            "A mechanism that is merely unstated in the lines is not a format failure, so pass stays true.",
          ]
        : input.id === "messageStays"
          ? [
              "pass is true when the lines together keep the Idea's message and the script adds no claim the Idea does not carry.",
              "One line may carry one part of the Idea. It does not have to repeat the experiment, the condition, and the consequence.",
              "The script as a whole must still carry those parts.",
              "The pillar's image, label, and way of speaking are not a new claim.",
              "An iceberg, a hidden part, a list, or a stop-list may say the same Idea.",
              "pass is false when a line changes the Idea's condition. Changing the only measure into the main measure is a changed condition.",
              "pass is false when a line turns the experiment's result into a broader claim, such as saying the value will never be identified.",
              "pass is false when a line adds a solution, a need, or a consequence the Idea does not carry.",
              "Do not fail a line only because it does not repeat the whole Idea.",
              "Do not fail a line only because it uses this pillar's format.",
              ...claimMaterialLines({ pillarDevelopment: input.pillarDevelopment, decisions: input.decisions }),
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
              : input.id === "emotionalTone"
                ? [
                    "pass is true only when the story shows the person it happens to.",
                    "That is the person living what the Idea below already says. We do not need their name. One item in a list can be that person.",
                    "The first line does not have to be that person. Put that person on the line where we see what happens to them.",
                    "pass is false when the story only explains how it works.",
                    "pass is false when the only person is the speaker asking how it works.",
                    "Someone who says saya berpikir or saya sadar is not that person.",
                    "pass is false when that person brings a product, a brand, a company, or a fix the Idea below does not already have.",
                    "Name the line id that still only explains how it works.",
                    "Do not fail because the words are calm, because a line says the Idea, or because the line follows this pillar's shape.",
                  ]
                : [];
  return [
    "Decide one Execution pass check. Do not rewrite the script.",
    ...rule,
    "When pass is false, reason says why in the same language as the Idea.",
    "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":"","lineIds":[]} or {"pass":false,"reason":"...","lineIds":["..."]}',
    "",
    `Pillar: ${input.pillar.trim()}`,
    ...(input.pillarCategory?.trim() ? [`Pillar category: ${input.pillarCategory.trim()}`] : []),
    ...(input.pillarDescription?.trim() ? [`Pillar description: ${input.pillarDescription.trim()}`] : []),
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

function readPassRow(
  row: { pass?: unknown; reason?: unknown; lineIds?: unknown; repeat?: unknown },
  known: ReadonlySet<string>,
): { pass: boolean; reason: string; lineIds: string[]; repeat: boolean } | null {
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  const lineIds = Array.isArray(row.lineIds)
    ? row.lineIds.flatMap((item) => {
        const id = typeof item === "string" ? item.trim() : "";
        return id && known.has(id) ? [id] : [];
      })
    : [];
  if (row.pass === true) return { pass: true, reason: "", lineIds: [], repeat: false };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED, lineIds, repeat: row.repeat === true };
  return null;
}

export function parseExecutionPassCheck(
  script: string | null,
  known: ReadonlySet<string>,
): { pass: boolean; reason: string; lineIds: string[]; repeat: boolean } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED, lineIds: [], repeat: false };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object") return { pass: false, reason: UNDECIDED, lineIds: [], repeat: false };
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const decisions = rows.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const decision = readPassRow(item as { pass?: unknown; reason?: unknown; lineIds?: unknown; repeat?: unknown }, known);
    return decision ? [decision] : [];
  });
  if (decisions.length === 0 || decisions.length !== rows.length) return { pass: false, reason: UNDECIDED, lineIds: [], repeat: false };
  const failed = decisions.filter((item) => !item.pass);
  if (failed.length === 0) return { pass: true, reason: "", lineIds: [], repeat: false };
  const lineIds = [...new Set(failed.flatMap((item) => item.lineIds))];
  const reason = failed.map((item) => item.reason).filter((item) => item && item !== UNDECIDED).join(" ") || UNDECIDED;
  return { pass: false, reason, lineIds, repeat: failed.some((item) => item.repeat) };
}

export function spokenNarrationLines(script: VoiceOverScript): Array<{ id: string; narration: string }> {
  return script.scenes.flatMap((scene) =>
    scene.lines.flatMap((line) => {
      if (line.delivery === "silent") return [];
      const narration = line.narration.trim();
      return narration ? [{ id: line.id, narration }] : [];
    }),
  );
}

export function openingNarrationLine(script: VoiceOverScript): { id: string; narration: string } | null {
  const scene = script.scenes.find((item) => item.purpose !== "cta");
  const line = scene?.lines.find((item) => item.narration.trim());
  if (!line) return null;
  return { id: line.id, narration: line.narration };
}

function linesFor(
  id: ExecutionPassCheckId,
  script: VoiceOverScript,
): Array<{ id: string; narration: string }> {
  if (id === "hookHolds") {
    const opening = openingNarrationLine(script);
    return opening ? [opening] : [];
  }
  if (id === "soundsSpoken" || id === "usesSlang") return spokenNarrationLines(script);
  if (id === "formatHolds") return chainNarrationLines(script);
  return chainNarrationLines(script);
}

function failedCheck(
  id: ExecutionPassCheckId,
  parsed: { reason: string; lineIds: string[] },
  lines: Array<{ id: string }>,
): ExecutionPassCheck {
  if (id === "hookHolds") {
    const openingId = lines[0]?.id ?? "";
    if (parsed.reason === UNDECIDED || !openingId) {
      return { id, state: "fail", reason: openingId ? UNDECIDED : MISSING_OPENING, lineIds: [] };
    }
    return {
      id,
      state: "fail",
      reason: parsed.reason,
      lineIds: parsed.lineIds.length > 0 ? parsed.lineIds : [openingId],
    };
  }
  if (id === "formatHolds") {
    const storyIds = lines.map((line) => line.id);
    if (parsed.reason === UNDECIDED || storyIds.length === 0) {
      return { id, state: "fail", reason: UNDECIDED, lineIds: [] };
    }
    if (parsed.repeat) {
      return { id, state: "fail", reason: parsed.reason, lineIds: [] };
    }
    return {
      id,
      state: "fail",
      reason: parsed.reason,
      lineIds: parsed.lineIds.length > 0 ? parsed.lineIds : storyIds,
    };
  }
  const lineIds = needsLineIds(id) ? parsed.lineIds : [];
  const undecided = needsLineIds(id) && lineIds.length === 0;
  return {
    id,
    state: "fail",
    reason: undecided ? UNDECIDED : parsed.reason,
    lineIds: undecided ? [] : lineIds,
  };
}

function needsLineIds(id: ExecutionPassCheckId): boolean {
  return LINE_CHECK_IDS.some((item) => item === id);
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
    if (check.enabled === false) continue;
    if (check.state !== "pass" && check.state !== "fail") break;
    const undecided = check.state === "fail" && check.reason === UNDECIDED;
    if (check.id === "pillarFits" && !undecided) fields.pillarOutside = check.state === "pass" ? false : true;
    if (check.id === "mechanismVisible" && !undecided) fields.mechanismVisible = check.state === "pass" ? true : false;
    if (check.id === "messageStays" && !undecided) fields.messageAdded = check.state === "pass" ? false : true;
    if (check.id === "viewerClimb" && !undecided) fields.viewerClimb = check.state === "pass" ? "CLIMBS" : "OTHER";
    if (check.state === "fail") break;
  }
  const failed = input.checks.find((check) => check.enabled !== false && check.state === "fail");
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
    unresolvedReasons: relation === "UNRESOLVED" ? ["CHECK_UNDECIDED"] : [],
    meaningAudit,
    auditLessons: input.auditLessons ?? [],
    passChecks: storedPassChecks(input.checks),
  };
}

export async function runExecutionMeaningChecks(input: {
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  masterSells: true | false | "unresolved" | "unknown";
  auditLessons?: ExecutionAuditLesson[];
  prior?: readonly ExecutionPassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  resolveSelling?: () => Promise<true | false | "unresolved">;
  onStep: (checks: ExecutionPassCheck[]) => void;
}): Promise<{ checks: ExecutionPassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  const checks = checklistWithPrior(input.prior, true);
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  let masterSells: ExecutionTriState = input.masterSells === "unknown" ? "unresolved" : input.masterSells;
  publish();
  for (const id of EXECUTION_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.enabled === false) continue;
    checks[index] = { id, state: "running", enabled: true };
    publish();
    if ((id === "soundsSpoken" || id === "usesSlang") && input.script.speech === "silent") {
      checks[index] = { id, state: "pass", enabled: true };
      publish();
      continue;
    }
    const lines = linesFor(id, input.script);
    if (id === "hookHolds" && lines.length === 0) {
      checks[index] = { id, state: "fail", enabled: true, reason: MISSING_OPENING, lineIds: [] };
      publish();
      break;
    }
    const known = knownIds(lines);
    const parsed = parseExecutionPassCheck(
      await input.ask(
        buildExecutionPassPrompt({
          id,
          pillar: input.pillar,
          pillarCategory: input.pillarCategory,
          pillarDescription: input.pillarDescription,
          masterStatement: input.masterStatement,
          masterSubject: input.masterSubject,
          ideaStatement: input.ideaStatement,
          ancestors: input.ancestors,
          pillarDevelopment: input.pillarDevelopment,
          decisions: input.script.decisions,
          lines,
        }),
      ),
      known,
    );
    if (!parsed.pass) {
      checks[index] = { ...failedCheck(id, parsed, lines), enabled: true };
      publish();
      break;
    }
    checks[index] = { id, state: "pass", enabled: true };
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

/** The checks implied by a stored audit. A requirement starts switched off until this run turned it on. */
export function executionChecksFromAudit(audit: ExecutionMeaningAudit | null | undefined): ExecutionPassCheck[] {
  if (audit && "cleared" in audit) {
    return EXECUTION_PASS_CHECK_IDS.map((id) =>
      videoCheckOnByDefault(id) ? { id, state: "pass" as const, enabled: true } : { id, state: "pass" as const, enabled: false },
    );
  }
  if (!isFailedMeaningAudit(audit)) return emptyExecutionPassChecklist();
  const failedAt = EXECUTION_PASS_CHECK_IDS.indexOf(audit.id);
  return EXECUTION_PASS_CHECK_IDS.map((id, index) => {
    if (id === audit.id) return { id, state: "fail", enabled: true, reason: audit.reason, lineIds: audit.lineIds };
    if (!videoCheckOnByDefault(id)) return { id, state: "pass", enabled: false };
    if (failedAt >= 0 && index < failedAt) return { id, state: "pass", enabled: true };
    return { id, state: "pending", enabled: true };
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
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  masterSells: true | false | "unresolved" | "unknown";
  auditLessons?: ExecutionAuditLesson[];
  prior: readonly ExecutionPassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  resolveSelling?: () => Promise<true | false | "unresolved">;
  onStep: (checks: ExecutionPassCheck[]) => void;
}): Promise<{ checks: ExecutionPassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  const checks = checklistWithPrior(input.prior, false);
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  let masterSells: ExecutionTriState = input.masterSells === "unknown" ? "unresolved" : input.masterSells;
  publish();
  for (const id of EXECUTION_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.enabled === false || checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running", enabled: true };
    publish();
    if ((id === "soundsSpoken" || id === "usesSlang") && input.script.speech === "silent") {
      checks[index] = { id, state: "pass", enabled: true };
      publish();
      continue;
    }
    const lines = linesFor(id, input.script);
    if (id === "hookHolds" && lines.length === 0) {
      checks[index] = { id, state: "fail", enabled: true, reason: MISSING_OPENING, lineIds: [] };
      publish();
      break;
    }
    const known = knownIds(lines);
    const parsed = parseExecutionPassCheck(
      await input.ask(
        buildExecutionPassPrompt({
          id,
          pillar: input.pillar,
          pillarCategory: input.pillarCategory,
          pillarDescription: input.pillarDescription,
          masterStatement: input.masterStatement,
          masterSubject: input.masterSubject,
          ideaStatement: input.ideaStatement,
          ancestors: input.ancestors,
          pillarDevelopment: input.pillarDevelopment,
          decisions: input.script.decisions,
          lines,
        }),
      ),
      known,
    );
    if (!parsed.pass) {
      checks[index] = { ...failedCheck(id, parsed, lines), enabled: true };
      publish();
      break;
    }
    checks[index] = { id, state: "pass", enabled: true };
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
  const caption = script.caption.trim();
  return {
    checkId: audit.id,
    reason: audit.reason,
    lines: audit.lineIds.flatMap((id) => {
      const narration = narrations.get(id);
      if (narration) return [narration];
      if (id === "caption" && caption) return [caption];
      return [];
    }),
  };
}

function lineRequirementRules(id: ExecutionPassCheckId, role: "opening" | "story" | "cta"): string[] {
  if (id === "hookHolds") {
    if (role !== "opening") return [];
    return [
      "This line is the first narration sentence.",
      "A stranger who hears only this sentence must know what situation they are in.",
      "The opening uses this pillar's format. A list format opens as a list. A story format opens as a story.",
      "A question or a what-if is allowed only when that shape is this pillar's format. Do not force one.",
      "Leave the problem unanswered.",
      "The sentence must stop making sense if that problem is removed.",
      "Do not use a sales question such as tahu nggak, did you know, or pernah merasa, unless that question is this pillar's format.",
    ];
  }
  if (id === "usesSlang") return slangWriterRules();
  if (id === "soundsSpoken") {
    return [
      "Write this line as everyday speech.",
      ...everydaySpeechWriterRules("video"),
      "Say it in everyday words. Do not copy the Idea's special terms.",
      "A stranger outside this field can read it out loud.",
      "Do not write a report, a definition, or a brochure.",
    ];
  }
  if (role === "cta") return [];
  if (id === "formatHolds") {
    return [
      "The spoken line uses this pillar's format.",
      "A list format stays a list item. A story format stays a story beat. Do not swap them.",
      "A list item says a different part of the Idea. Do not restate one point in new words.",
    ];
  }
  if (id === "pillarFits") return ["Do not force a message the Idea does not contain."];
  if (id === "mechanismVisible") return ["Do not hide the Idea's mechanism."];
  if (id === "messageStays") {
    return [
      "Do not add a claim, a solution, a need, or a consequence the Idea does not carry.",
      "This line may keep one part of the Idea. It does not have to repeat the whole Idea.",
      "A detail from the locked pillar communication or a locked story answer is not a new claim.",
      "A situation, a desire, or a consequence that is in none of the Idea, the locked pillar communication, and the locked story answers is a new claim.",
    ];
  }
  if (id === "causeChain") return ["The cause stays the Big Thought's stake. Do not install an advertisement or another cause."];
  if (id === "viewerClimb") return ["This line still lets a viewer climb toward the Master Thought. Do not land on another conclusion."];
  if (id === "emotionalTone") {
    return [
      "If this line is the moment it happens to someone, name that person. That is the person living what the Idea already says.",
      "Do not turn that moment into someone asking how it works.",
      "Do not add a person the Idea does not carry.",
    ];
  }
  return [];
}

/** Rewrite one narration line. Only the pass requirements that are switched on are included. */
export function buildNarrationLineRegeneratePrompt(input: {
  lineId: string;
  enabled: readonly ExecutionPassCheckId[];
  ideaStatement: string;
  masterStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  pillarName: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  refused?: readonly string[];
}): string {
  const sequence = input.script.scenes.flatMap((scene) =>
    scene.lines
      .filter((line) => line.narration.trim())
      .map((line) => ({ id: line.id, narration: line.narration.trim(), cta: scene.purpose === "cta" })),
  );
  const index = sequence.findIndex((line) => line.id === input.lineId);
  const current = sequence[index];
  const openingId = openingNarrationLine(input.script)?.id;
  const role: "opening" | "story" | "cta" = current?.cta ? "cta" : input.lineId === openingId ? "opening" : "story";
  const rules = input.enabled.flatMap((id) => lineRequirementRules(id, role));
  const claim =
    role !== "cta" && input.enabled.includes("messageStays")
      ? claimMaterialLines({ pillarDevelopment: input.pillarDevelopment, decisions: input.script.decisions })
      : [];
  const before = index > 0 ? sequence[index - 1] : null;
  const after = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
  const refused = (input.refused ?? []).map((line) => line.trim()).filter(Boolean);
  return [
    "Rewrite only this narration line.",
    "Return a new wording of the same beat. Do not copy the current narration.",
    "Change only the narration. Do not change shots, the other lines, the call to action, the brand name, the duration, the point of view, or the locked decisions.",
    rules.length > 0
      ? "The new line must pass every requirement below. A requirement that is switched off is not listed."
      : "No pass requirement is switched on. Keep the Idea.",
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\"}]}",
    "",
    "Requirements:",
    ...(rules.length > 0 ? rules : ["(none)"]),
    ...claim,
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    `Pillar: ${input.pillarName}`,
    ...(input.pillarCategory?.trim() ? [`Pillar category: ${input.pillarCategory.trim()}`] : []),
    ...(input.pillarDescription?.trim() ? [`Pillar description: ${input.pillarDescription.trim()}`] : []),
    ...(input.masterSubject?.trim() ? ["", `Master Thought subject: ${input.masterSubject.trim()}`] : []),
    "",
    "Line before:",
    before ? `${before.id}: ${before.narration}` : "(none)",
    "",
    "Line to rewrite:",
    `${input.lineId}: ${current?.narration ?? ""}`,
    "",
    "Line after:",
    after ? `${after.id}: ${after.narration}` : "(none)",
    ...(refused.length > 0 ? ["", "Do not return any of these narrations:", ...refused] : []),
  ].join("\n");
}

export function buildExecutionMeaningRepairPrompt(input: {
  ideaStatement: string;
  masterStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  pillarName: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  pillarDevelopment?: string | null;
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
    ...(input.checkId === "hookHolds"
      ? [
          "Replace the first narration sentence.",
          "A stranger who hears only that sentence must know what situation they are in.",
          "The opening uses this pillar's format. A list format opens as a list. A story format opens as a story.",
          "A question or a what-if is allowed only when that shape is this pillar's format. Do not force one.",
          "Leave the problem unanswered.",
          "The problem is the one running from the Master Thought through the Big Thought, Territory, and Angle into this Idea. Do not invent a sharper problem.",
          "The sentence must stop making sense if that problem is removed.",
          "Do not use a sales question such as tahu nggak, did you know, or pernah merasa, unless that question is this pillar's format.",
        ]
      : []),
    ...(input.checkId === "usesSlang"
      ? [
          "Rewrite the named lines into slang the audience would actually say.",
          ...slangWriterRules(),
          "Keep this pillar's format.",
        ]
      : []),
    ...(input.checkId === "soundsSpoken"
      ? [
          "Rewrite the stiff lines as everyday speech.",
          ...everydaySpeechWriterRules("video"),
          "Say what each line means in everyday words. Do not copy the Idea's special terms.",
          "A stranger outside this field can read it out loud.",
          "Do not write a report, a definition, or a brochure.",
          "Keep this pillar's format.",
        ]
      : []),
    ...(input.checkId === "formatHolds"
      ? [
          "Rewrite the named lines so the spoken script uses this pillar's format.",
          "A list format becomes a list. A story format becomes a story. Do not swap them.",
          "Each list item says a different part of the Idea. Do not restate one point in new words.",
          "The format's opening word may stay the same.",
          "The scene title is not the format. The spoken lines are.",
          "Keep the Idea. Do not add a claim the Idea does not carry.",
        ]
      : []),
    ...(input.checkId === "emotionalTone"
      ? [
          "Rewrite only the named line.",
          "Put on that line the person it happens to. That is the person living what the Idea already says.",
          "Do not leave the line as someone asking how it works.",
          "Keep this pillar's format.",
          "Do not add a claim, a product, a brand, a company, or a solution the Idea does not carry.",
          "Do not change the other lines.",
        ]
      : []),
    ...(input.checkId === "messageStays"
      ? [
          "Remove a situation, a desire, a need, or a consequence that is not in the Idea and not in the locked material.",
          "Keep a detail that the locked pillar communication or a locked story answer already names.",
          ...claimMaterialLines({ pillarDevelopment: input.pillarDevelopment, decisions: input.script.decisions }),
        ]
      : []),
    ...fixScopeLines(input.scope ?? { preserve: [], repair: [{ id: input.checkId, reason: input.reason }] }),
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\"}]}",
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    `Pillar: ${input.pillarName}`,
    ...(input.pillarCategory?.trim() ? [`Pillar category: ${input.pillarCategory.trim()}`] : []),
    ...(input.pillarDescription?.trim() ? [`Pillar description: ${input.pillarDescription.trim()}`] : []),
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

export type NarrationWordPart = { text: string; changed: boolean };

export type NarrationChange = {
  lineId: string;
  before: string;
  after: string;
  beforeWords: NarrationWordPart[];
  afterWords: NarrationWordPart[];
};

const NARRATION_FREE_CHECKS = new Set<ExecutionPassCheckId>(["imageShape", "imageCopy", "imagePrompt"]);

function narrationWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function sameNarration(left: string, right: string): boolean {
  return left.trim().replace(/\s+/g, " ") === right.trim().replace(/\s+/g, " ");
}

/** Words that left the old line and words that arrived in the new line. */
export function narrationWordParts(before: string, after: string): { beforeWords: NarrationWordPart[]; afterWords: NarrationWordPart[] } {
  const left = narrationWords(before);
  const right = narrationWords(after);
  const table: number[][] = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      table[row][column] = left[row] === right[column] ? table[row + 1][column + 1] + 1 : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  const beforeWords: NarrationWordPart[] = [];
  const afterWords: NarrationWordPart[] = [];
  let row = 0;
  let column = 0;
  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) {
      beforeWords.push({ text: left[row], changed: false });
      afterWords.push({ text: right[column], changed: false });
      row += 1;
      column += 1;
      continue;
    }
    if (table[row + 1][column] >= table[row][column + 1]) {
      beforeWords.push({ text: left[row], changed: true });
      row += 1;
    } else {
      afterWords.push({ text: right[column], changed: true });
      column += 1;
    }
  }
  while (row < left.length) {
    beforeWords.push({ text: left[row], changed: true });
    row += 1;
  }
  while (column < right.length) {
    afterWords.push({ text: right[column], changed: true });
    column += 1;
  }
  return { beforeWords, afterWords };
}

/** Changed narration lines, in the order of the lines that were sent to the writer. */
export function narrationChangeRows(
  beforeLines: readonly { id: string; narration: string }[],
  afterLines: readonly { id: string; narration: string }[],
): NarrationChange[] {
  const afterById = new Map(afterLines.map((line) => [line.id, line.narration.trim()]));
  return beforeLines.flatMap((line) => {
    const after = afterById.get(line.id);
    if (after == null || sameNarration(line.narration, after)) return [];
    return [{ lineId: line.id, before: line.narration.trim(), after, ...narrationWordParts(line.narration, after) }];
  });
}

export function passSwitchOutcome(changes: readonly NarrationChange[]): "save-switch" | "propose" {
  return changes.length === 0 ? "save-switch" : "propose";
}

/** Lines whose wording this requirement can change. Caption is included only for the caption requirement. */
export function switchRewriteLines(script: VoiceOverScript, checkId: ExecutionPassCheckId): Array<{ id: string; narration: string }> {
  if (NARRATION_FREE_CHECKS.has(checkId)) return [];
  if ((checkId === "soundsSpoken" || checkId === "usesSlang") && script.speech === "silent") return [];
  if (checkId === "imageCaption") {
    const caption = script.caption.trim();
    return caption ? [{ id: "caption", narration: caption }] : [];
  }
  return script.scenes.flatMap((scene) =>
    scene.lines.flatMap((line) => {
      const narration = line.narration.trim();
      return narration ? [{ id: line.id, narration }] : [];
    }),
  );
}

export function applyPassSwitchScript(
  script: VoiceOverScript,
  replacements: readonly { lineId: string; narration: string }[],
): VoiceOverScript {
  const caption = replacements.find((row) => row.lineId === "caption")?.narration.trim();
  const merged = mergeNarrationRepairs(
    script,
    replacements.filter((row) => row.lineId !== "caption"),
  );
  return caption ? { ...merged, caption } : merged;
}

/** Writer rules for a requirement that is still switched on. */
export function activeSwitchRules(id: ExecutionPassCheckId, surface: "video" | "image"): string[] {
  if (id === "hookHolds") {
    return surface === "image"
      ? [
          "The first slide is the opening. A stranger who reads only that slide knows the situation.",
          "The opening uses this pillar's format. A list opens as a list. A story opens as a story.",
          "A question or a what-if is allowed only when that shape is this pillar's format.",
          "Leave the problem unanswered.",
        ]
      : [
          "The first narration sentence of the first story scene is the opening.",
          "A stranger who hears only that sentence must know what situation they are in.",
          "The opening uses this pillar's format. A list format opens as a list. A story format opens as a story.",
          "A question or a what-if is allowed only when that shape is this pillar's format. Do not force one.",
          "Leave the problem unanswered.",
        ];
  }
  if (id === "soundsSpoken") {
    return ["Every spoken line is everyday speech.", "A stranger who does not work in this field can read it out loud.", ...everydaySpeechWriterRules(surface)];
  }
  if (id === "usesSlang") return slangWriterRules();
  if (id === "formatHolds") {
    return [
      "The spoken lines use this pillar's format.",
      "A list format is a list. A story format is a story. Do not swap them.",
      "A list is distinct items. Each spoken item says a different part of the Idea.",
    ];
  }
  if (id === "pillarFits") return ["Do not force a message outside the Idea."];
  if (id === "mechanismVisible") return ["A viewer must be able to see the Idea's mechanism."];
  if (id === "messageStays") {
    return [
      "Do not add a claim the Idea does not already carry.",
      "One spoken line may carry one part of the Idea.",
      "Keep the step the locked pillar communication already wrote.",
    ];
  }
  if (id === "causeChain") return ["The cause stays the Big Thought's stake. Do not install an advertisement or another cause."];
  if (id === "viewerClimb") {
    return ["A viewer must be able to climb from the mechanism to the Master Thought. Do not paste the Master Thought unchanged as a slogan."];
  }
  if (id === "emotionalTone") {
    return ["On the line where we see what happens to someone, put the person it happens to. Do not add a person the Idea does not carry."];
  }
  if (id === "imageCaption") return ["The caption does not copy the slides."];
  return [];
}

/** What to take back out of the wording when a requirement is switched off. */
export function switchReleaseRules(id: ExecutionPassCheckId): string[] {
  const shared =
    "Remove only the wording that existed to satisfy this requirement. Keep the step the locked pillar communication already wrote. Do not invent a new claim, a new scene, or a new step.";
  const specific: Partial<Record<ExecutionPassCheckId, string>> = {
    hookHolds: "The opening may be the pillar's first step in ordinary words.",
    soundsSpoken: "The line may use the pillar's own wording, including a report or a formal sentence.",
    usesSlang: "Write the same step without slang particles and without an informal address that was only there for slang.",
    pillarFits: "Leave a line that already carries the Idea. Remove a message that was added only so this pillar format could carry it.",
    formatHolds: "The spoken line may leave this pillar's list or story shape.",
    mechanismVisible: "Remove a sentence that exists only to display the Idea's mechanism.",
    messageStays: "Do not add a claim. If a line was shortened only to satisfy this requirement, restore the step already written in the locked pillar communication.",
    causeChain: "Remove a cause or an advertisement that was added only so the Big Thought's stake would be visible.",
    viewerClimb: "Remove a conclusion or a Master Thought slogan that was added only so the viewer would climb.",
    emotionalTone: "Remove a person who was named only so the story would show who it happens to, when the locked pillar communication did not name that person.",
    imageCaption: "The caption may follow the slides again. Remove wording that existed only so the caption would avoid the slides.",
  };
  const line = specific[id];
  return line ? [line, shared] : [shared];
}

export function buildPassSwitchRewritePrompt(input: {
  checkId: ExecutionPassCheckId;
  enabled: boolean;
  enabledIds: readonly ExecutionPassCheckId[];
  surface: "video" | "image";
  ideaStatement: string;
  masterStatement: string;
  pillarName: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  pillarDevelopment?: string | null;
  ancestors?: AncestorStake[];
  lines: readonly { id: string; narration: string }[];
}): string {
  const staying = input.enabledIds.filter((id) => input.enabled || id !== input.checkId);
  const onRules = staying.flatMap((id) => activeSwitchRules(id, input.surface));
  return [
    "Rewrite narration lines for one locked Idea and one content pillar.",
    "Change only the narration. Do not change shots, scene titles, the brand name, the duration, the point of view, or the locked decisions.",
    "Keep the order and the steps already written in the locked pillar communication.",
    "Do not invent a different communication.",
    input.enabled ? `The requirement ${input.checkId} was just switched on.` : `The requirement ${input.checkId} was just switched off.`,
    input.enabled
      ? "Write the narration so every requirement that is switched on is already true, including the one just switched on."
      : "Change a line only where the wording of the requirement that was just switched off is present.",
    input.enabled
      ? "Change a line when it does not yet satisfy one of the requirements that are switched on."
      : "Leave a line unchanged when it already satisfies every requirement that is still on.",
    ...(input.enabled ? ["Leave a line unchanged when it already satisfies every requirement that is switched on."] : []),
    "Return only the lines whose narration changes.",
    ...(input.enabled ? [] : switchReleaseRules(input.checkId)),
    ...(onRules.length > 0 ? ["Requirements that are switched on:", ...onRules] : ["No other requirement is switched on."]),
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\"}]}",
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    `Pillar: ${input.pillarName}`,
    ...(input.pillarCategory?.trim() ? [`Pillar category: ${input.pillarCategory.trim()}`] : []),
    ...(input.pillarDescription?.trim() ? [`Pillar description: ${input.pillarDescription.trim()}`] : []),
    ...pillarDevelopmentLines(input.pillarDevelopment),
    "",
    "Lines:",
    ...input.lines.map((line) => `${line.id}: ${line.narration}`),
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
