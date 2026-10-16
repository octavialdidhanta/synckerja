import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { judgeExecution } from "@/thinking-lab/execution/semantic";
import { executionPillarLabel, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

export function buildExecutionGeneratePrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  pillar: string;
  ancestors?: AncestorStake[];
}): string {
  const pillarLabel = executionPillarLabel(input.pillar);
  return [
    "Write one voice-over script for one locked Idea and one content pillar.",
    "The pillar is a format. It is not a new belief, territory, angle, or idea.",
    `Pillar: ${pillarLabel}.`,
    "The default deliverable is the Script VO: scenes, spoken narration, shots, and prompts.",
    "Do not add a claim the Idea does not already carry.",
    "A viewer must be able to see the Idea's mechanism and climb to the named Master Thought subject.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not force a message outside the Idea.",
    "Use a selling format only when the Master Thought is actually selling something. Otherwise do not invent a sale.",
    "Narration uses the same language as the Idea.",
    "Also write the single best post title and the single best caption for this pillar.",
    "The title is one short line a viewer reads before opening.",
    "Write the title the way someone would actually say it. It should feel spoken, not like a headline.",
    "Do not use a label, a colon, title case, or a template such as Tahukah kamu or Did you know.",
    "The caption does not retell the story, the scenes, or the narration.",
    "The caption is a few short points on why this is worth opening: the stake, the reason it is being discussed, and what the viewer should notice.",
    "Put one point on each line. Each point starts with an emoticon.",
    "End the caption with relevant hashtags on their own line. Hashtags are required.",
    "Write the title and the points to raise click-through.",
    "Title, points, and hashtags use the same language as the Idea.",
    "Do not add a claim or a fake number.",
    "Shot prompts use English and may name @location, @character, and @property tokens.",
    "Every token you use in a prompt must appear once in assets with a short description.",
    "Each scene has a title and narration lines. One narration line is one spoken sentence, not a paragraph.",
    "Every sentence needs more than one shot and more than one prompt, so the angles stay rich.",
    "Give each sentence a main shot plus at least one supporting shot. Add a third shot when the sentence shows a face, an object, a comparison, or a change.",
    "Each shot has its own angle and its own English prompt. Do not reuse the same angle or the same prompt inside that sentence.",
    "Vary the angles across wide, medium, close-up, insert, over-the-shoulder, and graphic overlay.",
    "Do not cover several sentences with only one or two shots.",
    ...ANCESTOR_STAKE_RULES,
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      title: "",
      caption: "",
      assets: {
        locations: [{ handle: "@location_example", description: "" }],
        characters: [{ handle: "@character_example", description: "" }],
        properties: [{ handle: "@property_example", description: "" }],
      },
      scenes: [
        {
          title: "SCENE 1 — HOOK",
          lines: [
            {
              narration: "",
              shots: [
                { role: "Shot 1 — Main Shot", angle: "", visualFunction: "", prompt: "" },
                { role: "Shot 2 — Supporting Shot", angle: "", visualFunction: "", prompt: "" },
              ],
            },
          ],
        },
      ],
    }),
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
  ].join("\n");
}

export function parseExecutionStatement(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const statement = (raw as { statement?: unknown }).statement;
  return typeof statement === "string" ? statement.trim() : "";
}

export async function judgeAndSealExecution(input: {
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  pillar: string;
  ancestors?: AncestorStake[];
  statement: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<ExecutionSemanticFacts> {
  return judgeExecution(
    {
      masterStatement: input.masterStatement,
      masterSubject: input.masterSubject,
      ideaStatement: input.ideaStatement,
      pillar: input.pillar,
      ancestors: input.ancestors,
      candidate: input.statement,
    },
    input.ask,
  );
}
