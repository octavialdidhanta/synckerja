import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { judgeExecution } from "@/thinking-lab/execution/semantic";
import { durationWordBudget, type ScriptSpeech } from "@/thinking-lab/execution/script";
import { executionPillarLabel, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

const SAID_SHAPE = '@character_example said: "the narration sentence, unchanged"';

function speechGenerateRules(speech?: ScriptSpeech): string[] {
  if (speech === "vo") {
    return [
      "Speech mode is voice-over only.",
      "Every narration line is voice-over. Set delivery to \"vo\".",
      "Characters do not mouth the words.",
      "Do not write said: in any shot prompt.",
    ];
  }
  if (speech === "mix") {
    return [
      "Speech mode mixes voice-over and on-screen dialogue. The script must contain both kinds. Do not use only one.",
      "A voice-over line has delivery \"vo\". The narrator speaks the narration. The character does not mouth the words. Do not write said: in those shot prompts.",
      "A dialogue line has delivery \"dialogue\". A character speaks the narration on screen.",
      `Only the main shot of a dialogue line includes this exact shape: ${SAID_SHAPE}.`,
      "Supporting shots of that same sentence do not repeat said:.",
      "The quotation is the narration sentence, unchanged, in the Idea's language. Do not translate it.",
      "The token is the speaking character's handle from assets.",
    ];
  }
  if (speech === "dialog") {
    return [
      "Speech mode is on-screen dialogue only. There is no voice-over.",
      "Every narration line is spoken on screen. Set delivery to \"dialogue\".",
      "Decide from the pillar and the Idea whether one person speaks to the camera or a second person answers.",
      "Story, podcast, and interview pillars get a counterpart. Other pillars are one person speaking to the camera.",
      "When a counterpart is present, both people are @character assets.",
      `Only the main shot of each sentence includes this exact shape: ${SAID_SHAPE}.`,
      "Supporting shots of that same sentence do not repeat said:.",
      "The quotation is the narration sentence, unchanged, in the Idea's language. Do not translate it.",
      "The token is the speaking character's handle from assets.",
    ];
  }
  if (speech === "silent") {
    return [
      "Speech mode has no voice-over and no dialogue.",
      "Each narration line is an unspoken beat: one short sentence in the Idea's language that states what the viewer should understand from the picture. It is not spoken.",
      "Set delivery to \"silent\".",
      "There is no narration to explain the picture, so each shot prompt must carry the context by itself.",
      "Write several sentences for every shot: who is present, where they are, what they do, which object shows the point, and what changes.",
      "A viewer who never hears the unspoken beat must still understand it from the shots together.",
      "Do not write a one-line caption. Do not write said: and do not write a voice-over.",
    ];
  }
  return [];
}

export function buildExecutionGeneratePrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  priorBelief?: string;
  ideaStatement: string;
  pillar: string;
  ancestors?: AncestorStake[];
  speech?: ScriptSpeech;
  durationSeconds?: number | null;
}): string {
  const pillarLabel = executionPillarLabel(input.pillar);
  return [
    "Write one voice-over script for one locked Idea and one content pillar.",
    "The pillar is a format. It is not a new belief, territory, angle, or idea.",
    `Pillar: ${pillarLabel}.`,
    "The default deliverable is the Script VO: scenes, spoken narration, shots, and prompts.",
    "Do not add a claim the Idea does not already carry.",
    "A viewer must be able to see the Idea's mechanism and climb to the named Master Thought subject.",
    "The viewer must see the Big Thought's stake happen, then see that stake, not an advertisement, move the outcome named by the Master Thought.",
    "End every script with its own conclusion scene, after the scene that shows the mechanism.",
    "The conclusion is one or two sentences. A viewer who hears only those sentences must be able to say the Master Thought.",
    "Say the Master Thought as what just happened in this situation, and leave the old belief behind.",
    "Do not stop at the mechanism. The mechanism scene comes before the conclusion.",
    "Do not title that scene Conclusion, Kesimpulan, or THE REAL REASON.",
    "Do not explain a new theory. Do not paste the Master Thought unchanged as a slogan, and do not hide it.",
    ...(input.durationSeconds && input.durationSeconds > 0
      ? [
          `Fit the narration to about ${Math.round(input.durationSeconds)} seconds, about ${durationWordBudget(input.durationSeconds)} words.`,
          "Do not make the script much shorter or much longer than that.",
        ]
      : []),
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
    "When a shot prompt names a @character token, that same prompt also names a @location token, so the place stays consistent from shot to shot.",
    "Reuse a location already listed in assets. Prefer the location already used with that character in the scene when the shot stays in that place.",
    "A prompt with no @character does not need a location.",
    "Every token you use in a prompt must appear once in assets with a short description.",
    input.speech === "silent" || input.speech === "dialog"
      ? "Each scene has a title and narration lines. One narration line is one sentence, not a paragraph."
      : "Each scene has a title and narration lines. One narration line is one spoken sentence, not a paragraph.",
    ...speechGenerateRules(input.speech),
    "Every sentence needs more than one shot and more than one prompt, so the angles stay rich.",
    ...(input.speech === "mix" || input.speech === "dialog"
      ? [
          "A dialogue sentence has at least three shots: the main shot carries the spoken line, plus two supporting shots with different angles and no said:.",
          input.speech === "mix"
            ? "A voice-over sentence keeps a main shot plus one supporting shot."
            : "Every sentence is dialogue, so every sentence has at least three shots.",
        ]
      : input.speech === "silent"
        ? [
            "A silent sentence has at least three shots, because the picture alone carries the meaning.",
            "Each shot prompt is several sentences long. Name who is present, where they are, the action, the object that shows the point, and the change a viewer can see.",
          ]
        : ["Give each sentence a main shot plus at least one supporting shot. Add a third shot when the sentence shows a face, an object, a comparison, or a change."]),
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
              ...(input.speech ? { delivery: input.speech === "mix" || input.speech === "vo" ? "vo" : input.speech === "dialog" ? "dialogue" : "silent" } : {}),
              shots: [
                {
                  role: "Shot 1 — Main Shot",
                  angle: "",
                  visualFunction: "",
                  prompt: input.speech === "dialog" ? `@character_example at @location_example. ${SAID_SHAPE}` : "",
                },
                { role: "Shot 2 — Supporting Shot", angle: "", visualFunction: "", prompt: "" },
                ...(input.speech === "dialog" || input.speech === "silent"
                  ? [{ role: "Shot 3 — Supporting Shot", angle: "", visualFunction: "", prompt: "" }]
                  : []),
              ],
            },
          ],
        },
      ],
    }),
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...(input.priorBelief?.trim() ? ["", "Old belief to leave behind:", input.priorBelief.trim()] : []),
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
