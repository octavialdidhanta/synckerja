import { creativeIdeaPromptLines } from "@/thinking-lab/creative-idea/generate";
import { confirmedDecisionRules, pillarDevelopmentLines, pillarFidelityLines, type ScriptDecision } from "@/thinking-lab/execution/confirm";
import { everydaySpeechWriterRules } from "@/thinking-lab/execution/passChecklist";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { ancestorStakeBlock } from "@/thinking-lab/shared/ancestorStake";
import type { ExecutionAuditLesson, ExecutionPassCheckId } from "@/thinking-lab/execution/types";
import type { ImageSettings } from "@/thinking-lab/execution/script";

export function buildImageGeneratePrompt(input: {
  masterStatement: string;
  ideaStatement: string;
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  ancestors?: AncestorStake[];
  image: ImageSettings;
  pointOfView?: string | null;
  decisions?: ScriptDecision[] | null;
  lessons?: readonly ExecutionAuditLesson[] | null;
  creativeIdea?: { statement?: string | null; concept?: string | null; mechanism?: string | null; value?: string | null } | null;
  pillarDevelopment?: string | null;
  enabled?: readonly ExecutionPassCheckId[] | null;
}): string {
  const settings = input.image;
  const count =
    settings.format === "single"
      ? "Write exactly one slide."
      : settings.slideCountMode === "manual" && settings.slideCount
        ? `Write exactly ${settings.slideCount} slides.`
        : "Choose 2 to 10 slides from the parts of the Idea. Do not use one slide for each item of a list.";
  const enabled = new Set(input.enabled ?? []);
  const on = (id: ExecutionPassCheckId) => enabled.has(id);
  const lessons = (input.lessons ?? []).filter((lesson) => enabled.has(lesson.checkId));
  const lessonBlock =
    lessons.length === 0
      ? []
      : [
          "Earlier failures. Do not repeat these lines or this mistake:",
          ...lessons.map((lesson) => `${lesson.checkId}: ${lesson.lines.join(" / ")}\nWhy it failed: ${lesson.reason}`),
          "",
        ];
  return [
    "Write one image post for one locked Idea and one content pillar.",
    "The pillar is a format. It is not a new belief.",
    `Pillar: ${input.pillar.trim()}.`,
    ...(input.pillarCategory?.trim() ? [`Pillar category: ${input.pillarCategory.trim()}.`] : []),
    ...(input.pillarDescription?.trim() ? [`Pillar description: ${input.pillarDescription.trim()}`] : []),
    count,
    "One slide is one scene with one narration line.",
    "The slide title is the section name, in this shape: Slide 1 - short label.",
    "The label is a few words that name the slide, such as a proverb or a short name. It is not a sentence of the script.",
    "Write what this pillar says, the way someone would speak it out loud.",
    "A slide may hold more than one short sentence.",
    "Keep the order and the steps already written in the locked pillar communication.",
    "Do not put the slide label inside the narration.",
    "Each list item says a different part of the Idea. A slide may state the Idea. That is not a repeated point. Two slides must not say the same point. The format's opening word may stay the same.",
    ...(on("soundsSpoken")
      ? [
          "The narration is everyday speech. A stranger who does not work in this field can read it out loud.",
          "Say what the Idea says in everyday words. Do not copy the Idea's special terms. Do not write a report, a definition, or a brochure.",
          ...everydaySpeechWriterRules("image"),
        ]
      : []),
    settings.withImage
      ? "Each slide has one image prompt. The prompt visualizes the context of that slide's narration. A person can paste it into an image generator."
      : "Do not write an image prompt. Leave shots empty. The slide is copy only.",
    "Do not add Shot 2 or Shot 3.",
    ...(on("hookHolds")
      ? [
          settings.format === "single"
            ? "The slide is the opening. A stranger who reads only that slide knows the situation. The slide may show only the situation and does not have to contain the whole problem. The problem stays unanswered."
            : "The first slide is the opening. A stranger who reads only that slide knows the situation. The first slide may show only the situation and does not have to contain the whole problem. The problem stays unanswered. Later slides carry the problem.",
          "The opening uses this pillar's format. A list opens as a list. A story opens as a story.",
          "A question or a what-if is allowed only when that shape is this pillar's format.",
        ]
      : []),
    ...(on("messageStays")
      ? [
          "Do not add a claim the Idea does not carry.",
          "Do not name a product, a brand, or a company. Do not offer a solution or a service the Idea does not carry.",
          "One slide may carry one part of the Idea.",
          ...pillarFidelityLines(input.pillarDevelopment),
        ]
      : []),
    ...(on("emotionalTone")
      ? [
          settings.format === "single"
            ? "In the caption, show someone living what the Idea says. They do not need a name or their own scene. A short point may also say how it works. The slide does not have to be that person. Do not invent a product, a brand, a company, or a fix the Idea does not already have."
            : "On a later slide, show someone living what the Idea says. They do not need a name or their own scene. That line may also say how it works. The first slide does not have to be that person. Do not invent a product, a brand, a company, or a fix the Idea does not already have.",
        ]
      : []),
    ...(input.pointOfView?.trim() ? [`Point of view: ${input.pointOfView.trim()}`] : []),
    ...confirmedDecisionRules(input.decisions, input.pointOfView),
    ...(on("imageCaption") ? ["The caption does not copy the slides."] : []),
    "The caption is a few short points on why this is worth opening.",
    "Put one caption point on each line. Each point starts with an emoticon.",
    "End the caption with relevant hashtags on their own line.",
    "Narration, title, and caption use the same language as the Idea.",
    "Image prompts use English.",
    "Return JSON only:",
    JSON.stringify({
      title: "",
      caption: "",
      scenes: [
        {
          title: "Slide 1 - short label",
          lines: [
            {
              narration: "everyday speech",
              shots: settings.withImage ? [{ role: "Image", angle: "", visualFunction: "", prompt: "" }] : [],
            },
          ],
        },
      ],
    }),
    ...lessonBlock,
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    ...pillarDevelopmentLines(input.pillarDevelopment),
    ...creativeIdeaPromptLines(input.creativeIdea),
  ].join("\n");
}
