import { creativeIdeaPromptLines } from "@/thinking-lab/creative-idea/generate";
import { confirmedDecisionRules, pillarDevelopmentLines, pillarFidelityLines, type ScriptDecision } from "@/thinking-lab/execution/confirm";
import { everydaySpeechWriterRules, slangWriterRules } from "@/thinking-lab/execution/passChecklist";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { judgeExecution } from "@/thinking-lab/execution/semantic";
import { durationWordBudget, type ScriptSpeech } from "@/thinking-lab/execution/script";
import { executionPillarLabel, type ExecutionAuditLesson, type ExecutionPassCheckId, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

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

function brandMentionRules(brand: string, speech?: ScriptSpeech): string[] {
  const name = brand.trim();
  if (!name) return [];
  const shared = [
    `The script must mention this brand name exactly: "${name}".`,
    "Keep that spelling. Do not translate the name.",
    "Say it at least once, inside the situation. Do not turn the script into an advertisement.",
  ];
  if (speech === "silent") {
    return [
      ...shared,
      "Put the brand name in one unspoken narration line.",
      "Also show that exact name as readable text in one shot prompt, such as a sign, a card, or a lower third.",
    ];
  }
  if (speech === "dialog") return [...shared, "A character says the brand name in one spoken line."];
  if (speech === "mix") return [...shared, "Say the brand name in one voice-over line or one dialogue line."];
  return [...shared, "The voice-over says the brand name in one narration line."];
}

function callToActionRules(cta: string, speech?: ScriptSpeech): string[] {
  const action = cta.trim();
  if (!action) return [];
  const shared = [
    `The video settings chose this action: "${action}".`,
    "That label names the action. It is not the scene.",
    "After the conclusion scene, add one new scene whose only job is this call to action.",
    "Do not put the call to action in the conclusion or in any earlier scene.",
    "Do not glue the invitation onto the conclusion scene.",
    "Write the new scene as one or two sentences in the Idea's language, from the locked point of view.",
    "Show why this viewer would take that action now. Do not make the scene only the settings label.",
    "Do not title that scene Conclusion, Kesimpulan, CTA, or Call to Action.",
    'Mark that scene with "purpose": "cta".',
  ];
  if (speech === "silent") {
    return [
      ...shared,
      "The unspoken narration carries the invitation.",
      "One shot shows the action as readable text, written as part of the picture, not as the settings label alone.",
    ];
  }
  if (speech === "dialog") return [...shared, "A character invites that action in the new scene. Do not paste the settings label as the whole line."];
  if (speech === "mix") return [...shared, "Say the invitation in the new scene as voice-over or dialogue. Do not paste the settings label as the whole line."];
  return [...shared, "The voice-over speaks the invitation in the new scene. Do not paste the settings label as the whole line."];
}

export function buildExecutionGeneratePrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  priorBelief?: string;
  ideaStatement: string;
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  ancestors?: AncestorStake[];
  speech?: ScriptSpeech;
  durationSeconds?: number | null;
  brandName?: string | null;
  cta?: string | null;
  pointOfView?: string | null;
  decisions?: ScriptDecision[] | null;
  lessons?: readonly ExecutionAuditLesson[] | null;
  creativeIdea?: { statement?: string | null; concept?: string | null; mechanism?: string | null; value?: string | null } | null;
  pillarDevelopment?: string | null;
  enabled?: readonly ExecutionPassCheckId[] | null;
}): string {
  const pillarLabel = executionPillarLabel(input.pillar);
  const brandName = input.brandName?.trim() ?? "";
  const cta = input.cta?.trim() ?? "";
  const enabled = new Set(input.enabled ?? []);
  const on = (id: ExecutionPassCheckId) => enabled.has(id);
  const lessons = (input.lessons ?? []).filter((lesson) => enabled.has(lesson.checkId));
  return [
    "Write one voice-over script for one locked Idea and one content pillar.",
    "The pillar is a format. It is not a new belief, territory, angle, or idea.",
    `Pillar: ${pillarLabel}.`,
    ...(input.pillarCategory?.trim() ? [`Pillar category: ${input.pillarCategory.trim()}.`] : []),
    ...(input.pillarDescription?.trim() ? [`Pillar description: ${input.pillarDescription.trim()}`] : []),
    "Write what this pillar says, the way someone would speak it out loud.",
    "Keep the order and the steps already written in the locked pillar communication.",
    "Narration uses the same language as the Idea.",
    ...confirmedDecisionRules(input.decisions, input.pointOfView),
    "The default deliverable is the Script VO: scenes, spoken narration, shots, and prompts.",
    ...(brandName ? [] : ["Do not say a brand name. The video settings did not ask for one."]),
    ...(on("formatHolds")
      ? [
          "Write the spoken lines in this pillar's format.",
          "Read the pillar name, its category, and its description.",
          "A list format is a list. A story format is a story. Do not swap them.",
          "A list is distinct items. Each spoken item says a different part of the Idea.",
          "Repeating one point in new words fails. The format's opening word may stay the same.",
          "The scene title is not the format. The spoken lines are.",
        ]
      : []),
    ...(on("messageStays")
      ? [
          "Do not add a claim the Idea does not already carry.",
          "One spoken line may carry one part of the Idea. The script together keeps the experiment, the condition, and the consequence.",
          "Do not change the only measure into the main measure, and do not turn the result into a broader claim.",
          "The pillar's image, label, and way of speaking may say that same Idea.",
          ...pillarFidelityLines(input.pillarDevelopment),
        ]
      : []),
    ...(on("mechanismVisible") ? ["A viewer must be able to see the Idea's mechanism."] : []),
    ...(on("viewerClimb")
      ? [
          "A viewer must be able to climb from that mechanism to the Master Thought.",
          "End every script with its own conclusion scene, after the scene that shows the mechanism.",
          "Do not stop at the mechanism. The mechanism scene comes before the conclusion.",
          "Do not title that scene Conclusion, Kesimpulan, or THE REAL REASON.",
          "Do not explain a new theory. Do not paste the Master Thought unchanged as a slogan, and do not hide it.",
        ]
      : []),
    ...(on("causeChain")
      ? [
          "The viewer must see the Big Thought's stake happen, then see that stake, not an advertisement, move the outcome named by the Master Thought.",
          ...ANCESTOR_STAKE_RULES,
        ]
      : []),
    ...(on("emotionalTone")
      ? [
          "On the line where we see what happens to someone, put the person it happens to. That is the person living what the Idea already says. Someone who only asks how it works is not that person. The opening does not have to be that person. They do not need a name. Do not invent a product, a brand, a company, or a fix the Idea does not already have.",
        ]
      : []),
    ...(input.pillarDevelopment?.trim()
      ? [
          "The locked pillar communication sets the order and the content.",
          "A shorter script is right when that communication is already complete.",
          "Do not add a situation, a desire, a method, or a consequence the locked pillar communication does not contain in order to fill the duration.",
        ]
      : []),
    ...(input.durationSeconds && input.durationSeconds > 0
      ? input.pillarDevelopment?.trim()
        ? [`The duration setting is about ${Math.round(input.durationSeconds)} seconds. The locked pillar communication comes first.`]
        : [
            `Fit the narration to about ${Math.round(input.durationSeconds)} seconds, about ${durationWordBudget(input.durationSeconds)} words.`,
            "Do not make the script much shorter or much longer than that.",
          ]
      : []),
    ...(on("pillarFits")
      ? [
          "Do not force a message outside the Idea.",
          "Use a selling format only when the Master Thought is actually selling something. Otherwise do not invent a sale.",
        ]
      : []),
    ...(on("hookHolds")
      ? [
          "The first narration sentence of the first story scene is the opening.",
          "A stranger who hears only that sentence must know what situation they are in.",
          "The opening uses this pillar's format. A list format opens as a list. A story format opens as a story.",
          "A question or a what-if is allowed only when that shape is this pillar's format. Do not force one.",
          "Leave the problem unanswered.",
          "The problem is the one running from the Master Thought through the Big Thought, Territory, and Angle into this Idea.",
          "Do not invent a sharper problem.",
          "The sentence must stop making sense if that problem is removed.",
          "Do not use a sales question such as tahu nggak, did you know, or pernah merasa, unless that question is this pillar's format.",
          "Do not open with a greeting, a pillar label, a number, the brand name, or the conclusion.",
          "Title, caption, later sentences, the conclusion scene, and the call-to-action scene are not the opening.",
        ]
      : []),
    ...(on("soundsSpoken") && input.speech !== "silent"
      ? [
          "Every spoken narration line, including the opening and the call to action, is everyday speech.",
          "A stranger who does not work in this field can read it out loud.",
          "Say what the Idea says in everyday words. Do not copy the Idea's special terms.",
          ...everydaySpeechWriterRules("video"),
          "Do not write a report, a definition, or a brochure.",
          "Keep this pillar's format. A list stays a list. A story stays a story.",
          "Each list item says a different part of the Idea. Do not restate one point in new words.",
          "Do not force a question or a what-if.",
        ]
      : []),
    ...(on("usesSlang") && input.speech !== "silent" ? slangWriterRules() : []),
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
    input.speech === "silent"
      ? "Each scene has a title and narration lines. One narration line is one sentence, not a paragraph."
      : input.speech === "dialog"
        ? "Each scene has a title and narration lines. One narration line is one sentence, or two short sentences about the same thing. It is not a paragraph."
        : "Each scene has a title and narration lines. One narration line is one spoken sentence, or two short spoken sentences about the same thing. It is not a paragraph.",
    ...speechGenerateRules(input.speech),
    ...brandMentionRules(brandName, input.speech),
    ...callToActionRules(cta, input.speech),
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
    brandName
      ? `Do not use examples from any specific industry or belief system. The only brand name allowed is "${brandName}".`
      : "Do not use examples from any specific industry, belief system, or brand.",
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
        ...(cta
          ? [
              {
                title: "SCENE — the invitation",
                purpose: "cta",
                lines: [
                  {
                    narration: "",
                    ...(input.speech
                      ? { delivery: input.speech === "mix" || input.speech === "vo" ? "vo" : input.speech === "dialog" ? "dialogue" : "silent" }
                      : {}),
                    shots: [
                      {
                        role: "Shot 1 — Main Shot",
                        angle: "",
                        visualFunction: "",
                        prompt: input.speech === "dialog" ? `@character_example at @location_example. ${SAID_SHAPE}` : "",
                      },
                    ],
                  },
                ],
              },
            ]
          : []),
      ],
    }),
    ...(lessons.length > 0
      ? [
          "Earlier failures. Do not repeat these narrations or this mistake:",
          ...lessons.map((lesson) => `${lesson.checkId}: ${lesson.lines.join(" / ")}\nWhy it failed: ${lesson.reason}`),
        ]
      : []),
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...(input.priorBelief?.trim() ? ["", "Old belief to leave behind:", input.priorBelief.trim()] : []),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    ...pillarDevelopmentLines(input.pillarDevelopment),
    ...creativeIdeaPromptLines(input.creativeIdea),
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
