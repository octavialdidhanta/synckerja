import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { angleExampleProblem } from "@/thinking-lab/angle/example";
import { angleSubjectProblem } from "@/thinking-lab/angle/subject";

export const ANGLE_PASS_CHECK_IDS = [
  "stakeHolds",
  "observationShape",
  "severalIdeas",
  "clearBoundary",
  "observationJob",
  "ownSubject",
  "livedExample",
  "siblingsDistinct",
] as const;

export type AnglePassCheckId = (typeof ANGLE_PASS_CHECK_IDS)[number];

const INDIVIDUAL_PASS_CHECK_IDS = [
  "stakeHolds",
  "observationShape",
  "severalIdeas",
  "clearBoundary",
  "observationJob",
  "ownSubject",
  "livedExample",
] as const satisfies readonly AnglePassCheckId[];

export type AnglePassCheckState = "pending" | "running" | "pass" | "fail";

export type AnglePassCheck = {
  id: AnglePassCheckId;
  state: AnglePassCheckState;
  reason?: string;
};

const UNDECIDED = "This check could not be decided.";

export function emptyAnglePassChecklist(): AnglePassCheck[] {
  return ANGLE_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

export function individualAnglePassChecksCleared(checks: readonly AnglePassCheck[]): boolean {
  return INDIVIDUAL_PASS_CHECK_IDS.every((id) => checks.some((check) => check.id === id && check.state === "pass"));
}

export function buildAnglePassPrompt(input: {
  id: (typeof INDIVIDUAL_PASS_CHECK_IDS)[number];
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  subject?: string;
  example?: string;
}): string {
  const rule =
    input.id === "stakeHolds"
      ? [
          "pass is true only when this Angle would stop being coherent if the distinctive stake of this Territory, or of the Big Thought or Master Thought above it, is removed.",
          "pass is false when the sentence would still stand as an Angle after that stake is removed.",
        ]
      : input.id === "observationShape"
        ? [
            "pass is true only when this is an observation, a contradiction, or a tension inside this Territory, narrower than the Territory and broader than an Idea.",
            "pass is false when it is a topic, domain, label, or category; a belief; a concrete creative concept; or a format, scene, channel, or production form.",
          ]
        : input.id === "severalIdeas"
          ? [
              "pass is true when this Angle can generate several semantically distinct Ideas.",
              "Distinct means different creative concepts. They may differ by mechanism, narrative concept, experiment, comparison, metaphor, proof structure, scenario, or character dynamic.",
              "pass is false when the only differences are wording, titles, format swaps, or cosmetic changes.",
              "A short sentence can pass. A long sentence can fail. Do not count words.",
            ]
          : input.id === "clearBoundary"
            ? [
                "pass is true when the observation keeps a useful boundary.",
                "pass is false when it is too vague or too broad to bound one point of view.",
              ]
          : input.id === "observationJob"
            ? [
                "pass is true only when the job is an observation: something rarely noticed, a contradiction, or a tension.",
                "pass is false when the sentence fits smoothly as a because-clause that supports a belief, or when it only restates the Territory.",
              ]
            : input.id === "livedExample"
              ? [
                  "pass is true only when the example is one concrete situation a person could point at, and that situation shows this same observation.",
                  "pass is false when the example only restates the explanation, names a brand or a belief system, or is already a finished Idea.",
                  `Example: ${input.example?.trim() || "(none)"}`,
                ]
              : [
                  "pass is true only when the short subject, read alone, names this same observation.",
                  "pass is false when the subject is the Territory's name, a piece of the Territory, or a chopped opening that does not name the observation.",
                  `Subject: ${input.subject?.trim() || "(none)"}`,
                ];
  return [
    "Decide one Angle pass check. Do not rewrite the sentence.",
    ...rule,
    "When pass is false, reason says why in the same language as the Territory.",
    "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Angle: ${input.statement.trim()}`,
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
  ].join("\n");
}

/** A missing or undecided answer fails the check. */
export function parseAnglePassCheck(script: string | null): { pass: boolean; reason: string } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

export function beginAngleSiblingCheck(checks: readonly AnglePassCheck[]): AnglePassCheck[] {
  if (!individualAnglePassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) => (check.id === "siblingsDistinct" ? { id: check.id, state: "running" } : { ...check }));
}

export function finishAngleSiblingCheck(
  checks: readonly AnglePassCheck[],
  pass: boolean,
  reason: string,
): AnglePassCheck[] {
  if (!individualAnglePassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) =>
    check.id === "siblingsDistinct"
      ? { id: check.id, state: pass ? "pass" : "fail", ...(pass ? {} : { reason: reason.trim() || UNDECIDED }) }
      : { ...check },
  );
}

export async function runAngleIndividualChecks(input: {
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  subject?: string;
  example?: string;
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: AnglePassCheck[]) => void;
}): Promise<{ checks: AnglePassCheck[]; passed: boolean }> {
  const checks = emptyAnglePassChecklist();
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    checks[index] = { id, state: "running" };
    publish();
    if (id === "ownSubject") {
      const problem = angleSubjectProblem(input.subject ?? "", input.parentStatement);
      if (problem) {
        checks[index] = { id, state: "fail", reason: problem };
        publish();
        return { checks: checks.map((check) => ({ ...check })), passed: false };
      }
    }
    if (id === "livedExample") {
      const problem = angleExampleProblem(input.example ?? "", input.statement);
      if (problem) {
        checks[index] = { id, state: "fail", reason: problem };
        publish();
        return { checks: checks.map((check) => ({ ...check })), passed: false };
      }
    }
    const script = await input.ask(
      buildAnglePassPrompt({
        id,
        statement: input.statement,
        parentStatement: input.parentStatement,
        ancestors: input.ancestors,
        subject: input.subject,
        example: input.example,
      }),
    );
    const parsed = parseAnglePassCheck(script);
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

/** Re-ask the checks that failed or have not run. Checks that already passed stay passed. */
export async function runAngleOpenChecks(input: {
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  subject?: string;
  example?: string;
  prior: readonly AnglePassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: AnglePassCheck[]) => void;
}): Promise<{ checks: AnglePassCheck[]; passed: boolean }> {
  const checks = emptyAnglePassChecklist().map((check) => {
    const previous = input.prior.find((item) => item.id === check.id);
    return previous?.state === "pass" ? { id: check.id, state: "pass" as const } : { id: check.id, state: "pending" as const };
  });
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "ownSubject") {
      const problem = angleSubjectProblem(input.subject ?? "", input.parentStatement);
      if (problem) {
        checks[index] = { id, state: "fail", reason: problem };
        publish();
        return { checks: checks.map((check) => ({ ...check })), passed: false };
      }
    }
    if (id === "livedExample") {
      const problem = angleExampleProblem(input.example ?? "", input.statement);
      if (problem) {
        checks[index] = { id, state: "fail", reason: problem };
        publish();
        return { checks: checks.map((check) => ({ ...check })), passed: false };
      }
    }
    const script = await input.ask(
      buildAnglePassPrompt({
        id,
        statement: input.statement,
        parentStatement: input.parentStatement,
        ancestors: input.ancestors,
        subject: input.subject,
        example: input.example,
      }),
    );
    const parsed = parseAnglePassCheck(script);
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
