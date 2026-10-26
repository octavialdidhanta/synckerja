import { IDEA_GENERATE_PASS_IDS, readIdeaGeneratePasses } from "@/thinking-lab/idea/generatePasses";
import { announcedConclusionReason, ideaAnnouncesConclusion } from "@/thinking-lab/idea/semantic";
import type { IdeaGeneratePass } from "@/thinking-lab/idea/types";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";
import type { IdeaMechanismKey } from "@/thinking-lab/idea/types";
import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";

export const IDEA_PASS_CHECK_IDS = [
  "sentenceForm",
  "stakeHolds",
  "mechanismShape",
  "vehicle",
  "recognizable",
  "situationFelt",
  "causeLock",
  "siblingsDistinct",
] as const;

export type IdeaPassCheckId = (typeof IDEA_PASS_CHECK_IDS)[number];

const INDIVIDUAL_PASS_CHECK_IDS = [
  "sentenceForm",
  "stakeHolds",
  "mechanismShape",
  "vehicle",
  "recognizable",
  "situationFelt",
  "causeLock",
] as const satisfies readonly IdeaPassCheckId[];

export type IdeaPassCheckState = "pending" | "running" | "pass" | "fail";

export type IdeaPassCheck = {
  id: IdeaPassCheckId;
  state: IdeaPassCheckState;
  reason?: string;
};

const UNDECIDED = "This check could not be decided.";
const MISSING_SUBJECT = "The Master Thought subject was not named.";
const MISSING_KEYS = "The keys that close other explanations did not come back.";

export function emptyIdeaPassChecklist(): IdeaPassCheck[] {
  return IDEA_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

/** Checklist shown while Generate is judging a sentence. Later Audit checks stay off this list. */
export function ideaAdmissionChecks(
  failed?: { id: IdeaGeneratePass; reason: string } | null,
): IdeaPassCheck[] {
  return IDEA_GENERATE_PASS_IDS.map((id) => {
    if (!failed) return { id, state: "pending" };
    const index = IDEA_GENERATE_PASS_IDS.indexOf(id);
    const failIndex = IDEA_GENERATE_PASS_IDS.indexOf(failed.id);
    if (index < failIndex) return { id, state: "pass" };
    if (id === failed.id) return { id, state: "fail", reason: failed.reason };
    return { id, state: "pending" };
  });
}

/** A new sentence loses the two Generate passes. Checks that passed on this sentence stay. */
export function fixPriorForNextIdeaStatement(
  prior: readonly IdeaPassCheck[],
  previousStatement: string,
  nextStatement: string,
): IdeaPassCheck[] {
  const changed = previousStatement.trim().toLocaleLowerCase() !== nextStatement.trim().toLocaleLowerCase();
  return prior.map((item) =>
    changed && (item.id === "sentenceForm" || item.id === "mechanismShape")
      ? { id: item.id, state: "pending" }
      : { ...item },
  );
}

/** The checklist a card shows after refresh, before a live run replaces it. */
export function ideaChecksFromStored(input: {
  generatePasses?: unknown;
  gateFailure?: { gate: IdeaPassCheckId; reason: string } | null;
  passed?: boolean;
}): IdeaPassCheck[] {
  if (input.passed) return IDEA_PASS_CHECK_IDS.map((id) => ({ id, state: "pass" }));
  const carried = new Set(readIdeaGeneratePasses(input.generatePasses));
  const failure = input.gateFailure ?? null;
  const failIndex = failure ? IDEA_PASS_CHECK_IDS.indexOf(failure.gate) : -1;
  if (!failure && carried.size === 0) return [];
  return IDEA_PASS_CHECK_IDS.map((id, index) => {
    if (failure && id === failure.gate) return { id, state: "fail", reason: failure.reason };
    if (carried.has(id as IdeaGeneratePass)) return { id, state: "pass" };
    if (failure && index > failIndex) return { id, state: "pending" };
    if (failure && index < failIndex) return { id, state: "pass" };
    return { id, state: "pending" };
  });
}

export function individualIdeaPassChecksCleared(checks: readonly IdeaPassCheck[]): boolean {
  return INDIVIDUAL_PASS_CHECK_IDS.every((id) => checks.some((check) => check.id === id && check.state === "pass"));
}

/** Every check on the card, including the sibling check, has passed. */
export function ideaChecklistPassed(checks: readonly IdeaPassCheck[] | undefined): boolean {
  if (!checks || checks.length === 0) return false;
  return IDEA_PASS_CHECK_IDS.every((id) => checks.some((check) => check.id === id && check.state === "pass"));
}

/** A finished checklist is a pass even when the stored verdict has not been written yet. */
export function ideaVerdictForStage(
  stored: AuditVerdict | null,
  checks: readonly IdeaPassCheck[] | undefined,
): AuditVerdict | null {
  if (ideaChecklistPassed(checks)) return "AUDIT_PASS";
  return stored;
}

function keyLines(keys: IdeaMechanismKey[] | undefined): string[] {
  const rows = (keys ?? []).filter((key) => key.otherExplanation.trim() && key.close.trim());
  if (rows.length === 0) return ["Mechanism keys: (none)"];
  return ["Mechanism keys:", ...rows.map((key) => `- ${key.otherExplanation.trim()} / ${key.close.trim()}`)];
}

export function buildIdeaPassPrompt(input: {
  id: (typeof INDIVIDUAL_PASS_CHECK_IDS)[number];
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  masterSubject?: string;
  mechanismKeys?: IdeaMechanismKey[];
}): string {
  const subject = input.masterSubject?.trim() ?? "";
  const rule =
    input.id === "sentenceForm"
      ? [
          "pass is true only when the sentence names what is made, invited, shown, or created, and then what that makes true.",
          "pass is false when it does not say both the act and what becomes true.",
        ]
      : input.id === "stakeHolds"
        ? [
            "pass is true only when this Idea would stop being coherent if the distinctive stake of this Angle, or of the Territory, Big Thought, or Master Thought above it, is removed.",
            "pass is false when the sentence would still stand as an Idea after that stake is removed.",
          ]
        : input.id === "mechanismShape"
          ? [
              "pass is true only when this is a mechanism that makes the Angle happen, become visible, or be proved.",
              "pass is false when it is still an observation, a territory or life-area name, a because-reason, a finished story, a lesson, a chart, a shot list, dialogue, or another finished production form.",
            ]
          : input.id === "vehicle"
            ? [
                "pass is true only when the vehicle is a comparison, a contrast, an experiment, a demonstration, or a situation.",
                "pass is false when it is a narrative, a metaphor, or any other vehicle.",
              ]
            : input.id === "recognizable"
              ? [
                  "pass is true when another person can tell which mechanism is set up, and the concept has a recognizable boundary.",
                  "pass is false when the mechanism is missing or the concept is too vague to bound.",
                ]
              : input.id === "situationFelt"
                ? [
                    "pass is true when a comparison, a contrast, an experiment, a demonstration, or a situation names the mechanism and what the mechanism makes true, so the reason happens there.",
                    "pass is false when the sentence explains the Big Thought in words instead of naming what the mechanism makes true.",
                    "pass is false when the sentence announces the conclusion with shows that, proves that, highlights that, menunjukkan bahwa, membuktikan bahwa, or menyoroti bahwa, even if it also names what the mechanism makes true.",
                  ]
                : [
                    "pass is true only when the separate keys name each other explanation a viewer might reach and how this Idea closes it, so the named Master Thought subject is the only plausible cause.",
                    "pass is false when a key is missing, another explanation remains open, or a key only says this shows, proves, or highlights a conclusion.",
                    subject ? `Master Thought subject: ${subject}` : "No Master Thought subject was named, so pass is false.",
                  ];
  return [
    "Decide one Idea pass check. Do not rewrite the sentence.",
    ...rule,
    "When pass is false, reason says why in the same language as the Angle.",
    "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Idea: ${input.statement.trim()}`,
    "Direct Angle:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    ...(input.id === "causeLock" ? ["", ...keyLines(input.mechanismKeys)] : []),
  ].join("\n");
}

function announcedSituationFailure(statement: string): IdeaPassCheck | null {
  if (!ideaAnnouncesConclusion(statement)) return null;
  return { id: "situationFelt", state: "fail", reason: announcedConclusionReason(statement) };
}

/** A missing or undecided answer fails the check. */
export function parseIdeaPassCheck(script: string | null): { pass: boolean; reason: string } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

export function beginIdeaSiblingCheck(checks: readonly IdeaPassCheck[]): IdeaPassCheck[] {
  if (!individualIdeaPassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) => (check.id === "siblingsDistinct" ? { id: check.id, state: "running" } : { ...check }));
}

export function finishIdeaSiblingCheck(
  checks: readonly IdeaPassCheck[],
  pass: boolean,
  reason: string,
): IdeaPassCheck[] {
  if (!individualIdeaPassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) =>
    check.id === "siblingsDistinct"
      ? { id: check.id, state: pass ? "pass" : "fail", ...(pass ? {} : { reason: reason.trim() || UNDECIDED }) }
      : { ...check },
  );
}

export async function runIdeaAdmissionChecks(input: {
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: IdeaPassCheck[]) => void;
}): Promise<{ checks: IdeaPassCheck[]; passed: boolean }> {
  const checks = ideaAdmissionChecks();
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  for (const id of IDEA_GENERATE_PASS_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    checks[index] = { id, state: "running" };
    publish();
    const prompt = buildIdeaPassPrompt({
      id,
      statement: input.statement,
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
    });
    let script = await input.ask(prompt);
    let parsed = parseIdeaPassCheck(script);
    if (!parsed.pass && parsed.reason === UNDECIDED) {
      script = await input.ask(prompt);
      parsed = parseIdeaPassCheck(script);
    }
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true };
}

export async function runIdeaIndividualChecks(input: {
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  masterSubject?: string;
  mechanismKeys?: IdeaMechanismKey[];
  /** Both Generate passes for this exact sentence. Audit does not ask these again. */
  carried?: readonly IdeaGeneratePass[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: IdeaPassCheck[]) => void;
}): Promise<{ checks: IdeaPassCheck[]; passed: boolean }> {
  const carried = new Set(readIdeaGeneratePasses(input.carried));
  const checks = emptyIdeaPassChecklist().map((check) =>
    carried.has(check.id as IdeaGeneratePass) ? { id: check.id, state: "pass" as const } : check,
  );
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "situationFelt") {
      const blocked = announcedSituationFailure(input.statement);
      if (blocked) {
        checks[index] = blocked;
        publish();
        return { checks: checks.map((check) => ({ ...check })), passed: false };
      }
    }
    if (id === "causeLock" && !input.masterSubject?.trim()) {
      checks[index] = { id, state: "fail", reason: MISSING_SUBJECT };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    const usableKeys = (input.mechanismKeys ?? []).filter((key) => key.otherExplanation.trim() && key.close.trim());
    if (id === "causeLock" && usableKeys.length === 0) {
      checks[index] = { id, state: "fail", reason: MISSING_KEYS };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    const script = await input.ask(
      buildIdeaPassPrompt({
        id,
        statement: input.statement,
        parentStatement: input.parentStatement,
        ancestors: input.ancestors,
        masterSubject: input.masterSubject,
        mechanismKeys: input.mechanismKeys,
      }),
    );
    const parsed = parseIdeaPassCheck(script);
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true };
}

/** Re-ask the checks that failed or have not run. A passed check stays passed, except an announced conclusion, which fails situationFelt. */
export async function runIdeaOpenChecks(input: {
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  masterSubject?: string;
  mechanismKeys?: IdeaMechanismKey[];
  prior: readonly IdeaPassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: IdeaPassCheck[]) => void;
}): Promise<{ checks: IdeaPassCheck[]; passed: boolean }> {
  const checks: IdeaPassCheck[] = emptyIdeaPassChecklist().map((check) => {
    const previous = input.prior.find((item) => item.id === check.id);
    return previous?.state === "pass" ? { id: check.id, state: "pass" as const } : { id: check.id, state: "pending" as const };
  });
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    const announced = id === "situationFelt" ? announcedSituationFailure(input.statement) : null;
    if (announced) {
      checks[index] = { id, state: "running" };
      publish();
      checks[index] = announced;
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    if (checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "causeLock" && !input.masterSubject?.trim()) {
      checks[index] = { id, state: "fail", reason: MISSING_SUBJECT };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    const usableKeys = (input.mechanismKeys ?? []).filter((key) => key.otherExplanation.trim() && key.close.trim());
    if (id === "causeLock" && usableKeys.length === 0) {
      checks[index] = { id, state: "fail", reason: MISSING_KEYS };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    const script = await input.ask(
      buildIdeaPassPrompt({
        id,
        statement: input.statement,
        parentStatement: input.parentStatement,
        ancestors: input.ancestors,
        masterSubject: input.masterSubject,
        mechanismKeys: input.mechanismKeys,
      }),
    );
    const parsed = parseIdeaPassCheck(script);
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true };
}
