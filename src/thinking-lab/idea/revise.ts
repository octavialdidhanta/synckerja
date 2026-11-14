// Revise: rewrite the same Idea card from its failed checks, at most three times.
import { howIfInstruction } from "./check/guards";
import type { IdeaCheckId } from "./check/ids";
import type { IdeaValidationDecision } from "./check/record";

const IDEA_REVISION_CAP = 3;

type Lineage = { id: string; parentIdeaId: string | null };

function ideaRootId(id: string, rows: readonly Lineage[]): string {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const parentId = byId.get(current)?.parentIdeaId;
    if (!parentId || !byId.has(parentId)) return current;
    current = parentId;
  }
  return current;
}

export function revisionCount(id: string, rows: readonly Lineage[]): number {
  const root = ideaRootId(id, rows);
  return rows.filter((row) => row.id !== root && ideaRootId(row.id, rows) === root).length;
}

export function canReviseIdea(row: Lineage, rows: readonly Lineage[], decision: IdeaValidationDecision, storedRevisions = 0): boolean {
  const used = Math.max(revisionCount(row.id, rows), storedRevisions);
  return decision !== "LOLOS" && used < IDEA_REVISION_CAP;
}

export function buildIdeaRevisionPrompt(input: {
  angle: string;
  statement: string;
  failed: readonly { id: IdeaCheckId; reason: string }[];
  passed: readonly { id: IdeaCheckId; reason: string }[];
  revision: number;
}): string {
  const list = (rows: readonly { id: IdeaCheckId; reason: string }[]) =>
    rows.length ? rows.map((row) => `${row.id}: ${row.reason || "(lolos)"}`).join("\n") : "(none)";
  return [
    "Repair this same Idea. Do not create a different Idea and do not add another card.",
    howIfInstruction(input.angle),
    "Change only the wording the failed checks need. Keep every passed check true.",
    "A person, demonstration, or situation inside the Idea is not this audience's habit. Do not delete it because that person does something the audience does not do.",
    "When the distinct check calls a different audience action mere emphasis, keep that action. Telling, recording, comparing, asking, looking, and discussing are different actions.",
    "Do not turn it into only a fact, insight, problem, goal, general strategy, activity, technique, or a finished story.",
    "Write the keys separately: each key names another explanation a viewer might reach and how this Idea closes it.",
    'Return JSON only: {"ideas":[{"title":"...","statement":"...","concept":"...","mechanism":"...","value":"...","keys":[{"otherExplanation":"...","close":"..."}]}]}',
    `This is repair ${input.revision} of ${IDEA_REVISION_CAP} on the same card.`,
    "",
    `Angle: ${input.angle.trim()}`,
    "Idea on this card:",
    input.statement.trim(),
    "",
    "Passed checks that must stay true:",
    list(input.passed),
    "",
    "Failed checks to repair:",
    list(input.failed),
  ].join("\n");
}
