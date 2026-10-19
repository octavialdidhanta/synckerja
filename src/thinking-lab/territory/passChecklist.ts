import { parseModelJson } from "@/thinking-lab/shared/ai";

export const TERRITORY_PASS_CHECK_IDS = [
  "partOfBigThought",
  "audienceLanguage",
  "questionArises",
  "wideEnough",
  "siblingsDistinct",
] as const;

export type TerritoryPassCheckId = (typeof TERRITORY_PASS_CHECK_IDS)[number];

const INDIVIDUAL_PASS_CHECK_IDS = [
  "partOfBigThought",
  "audienceLanguage",
  "questionArises",
  "wideEnough",
] as const satisfies readonly TerritoryPassCheckId[];

export type TerritoryPassCheckState = "pending" | "running" | "pass" | "fail";

export type TerritoryPassCheck = {
  id: TerritoryPassCheckId;
  state: TerritoryPassCheckState;
  reason?: string;
};

const UNDECIDED = "This check could not be decided.";
const MISSING_QUESTION = "The question this Big Thought answers did not come back.";

export function emptyPassChecklist(): TerritoryPassCheck[] {
  return TERRITORY_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

export function individualPassChecksCleared(checks: readonly TerritoryPassCheck[]): boolean {
  return INDIVIDUAL_PASS_CHECK_IDS.every((id) => checks.some((check) => check.id === id && check.state === "pass"));
}

export function buildTerritoryPassPrompt(input: {
  id: (typeof INDIVIDUAL_PASS_CHECK_IDS)[number];
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
}): string {
  const audience = input.audience?.trim();
  const question = input.question?.trim() ?? "";
  const rule =
    input.id === "partOfBigThought"
      ? [
          "pass is true when the name is an area in the audience's world where this Big Thought can be discussed, and the name is not a keyword copied from the Big Thought.",
          "pass is false only when the name is only a keyword copied from the Big Thought: its title, its reason, or a short restatement of its words.",
          "A word that also appears in the Big Thought does not make the name a copied keyword when the name still names a different area.",
          "Being able to discuss other subjects in that area does not make pass false.",
          "Kurir paket passes under a Big Thought about delivery cost. Biaya kirim fails because it copies the Big Thought.",
        ]
      : input.id === "audienceLanguage"
        ? [
            "pass is true when these words are how the audience would name this area.",
            "pass is false when the words are an internal strategy term or jargon the audience would not use.",
            audience ? `Audience: ${audience}` : "Use the audience named with the Big Thought.",
          ]
        : input.id === "questionArises"
          ? [
              "pass is true only when the question the Big Thought answers actually comes up in this area.",
              "pass is false when a different question comes up there, or the question only restates the Big Thought.",
              "Judge the supplied question only. Do not replace it with a question taken from the Territory name or from another subject.",
              question ? `Question the Big Thought answers: ${question}` : "No question was supplied, so pass is false.",
            ]
          : [
              "pass is true when this area can hold several different Angles, not paraphrases of one observation.",
              "pass is false when the area can hold only one observation.",
            ];
  return [
    "Decide one Territory pass check. Do not rewrite the name.",
    ...rule,
    "When pass is false, reason says why in the same language as the Big Thought.",
    input.id === "partOfBigThought"
      ? "When the name is a recognizable area and the only doubt is a shared word or whether the area is exclusive to the Big Thought, return pass true. When you cannot decide whether it names an area at all, do not return pass true."
      : "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Territory: ${input.statement.trim()}`,
    "Big Thought:",
    input.parentStatement.trim(),
  ].join("\n");
}

/** A missing or undecided answer fails the check. */
export function parseTerritoryPassCheck(script: string | null): { pass: boolean; reason: string } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

export function beginSiblingCheck(checks: readonly TerritoryPassCheck[]): TerritoryPassCheck[] {
  if (!individualPassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) => (check.id === "siblingsDistinct" ? { id: check.id, state: "running" } : { ...check }));
}

export function finishSiblingCheck(
  checks: readonly TerritoryPassCheck[],
  pass: boolean,
  reason: string,
): TerritoryPassCheck[] {
  if (!individualPassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) =>
    check.id === "siblingsDistinct"
      ? { id: check.id, state: pass ? "pass" : "fail", ...(pass ? {} : { reason: reason.trim() || UNDECIDED }) }
      : { ...check },
  );
}

export async function runTerritoryIndividualChecks(input: {
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
  ensureQuestion?: () => Promise<string>;
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: TerritoryPassCheck[]) => void;
}): Promise<{ checks: TerritoryPassCheck[]; passed: boolean; question: string }> {
  const checks = emptyPassChecklist();
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  let question = input.question?.trim() ?? "";
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    checks[index] = { id, state: "running" };
    publish();
    if (id === "questionArises" && !question && input.ensureQuestion) {
      try {
        question = (await input.ensureQuestion()).trim();
      } catch {
        question = "";
      }
    }
    if (id === "questionArises" && !question) {
      checks[index] = { id, state: "fail", reason: MISSING_QUESTION };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    const script = await input.ask(
      buildTerritoryPassPrompt({
        id,
        statement: input.statement,
        parentStatement: input.parentStatement,
        audience: input.audience,
        question,
      }),
    );
    const parsed = parseTerritoryPassCheck(script);
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true, question };
}

/** Re-ask the checks that failed or have not run. Checks that already passed stay passed. */
export async function runTerritoryOpenChecks(input: {
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
  ensureQuestion?: () => Promise<string>;
  prior: readonly TerritoryPassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: TerritoryPassCheck[]) => void;
}): Promise<{ checks: TerritoryPassCheck[]; passed: boolean; question: string }> {
  const checks = emptyPassChecklist().map((check) => {
    const previous = input.prior.find((item) => item.id === check.id);
    return previous?.state === "pass" ? { id: check.id, state: "pass" as const } : { id: check.id, state: "pending" as const };
  });
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  let question = input.question?.trim() ?? "";
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "questionArises" && !question && input.ensureQuestion) {
      try {
        question = (await input.ensureQuestion()).trim();
      } catch {
        question = "";
      }
    }
    if (id === "questionArises" && !question) {
      checks[index] = { id, state: "fail", reason: MISSING_QUESTION };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    const script = await input.ask(
      buildTerritoryPassPrompt({
        id,
        statement: input.statement,
        parentStatement: input.parentStatement,
        audience: input.audience,
        question,
      }),
    );
    const parsed = parseTerritoryPassCheck(script);
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true, question };
}
