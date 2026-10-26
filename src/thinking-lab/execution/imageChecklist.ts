import { claimMaterialLines } from "@/thinking-lab/execution/confirm";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { everydaySpeechJudgeRules, everydaySpeechWriterRules, parseExecutionPassCheck, storedPassChecks } from "@/thinking-lab/execution/passChecklist";
import type { ImageSettings, VoiceOverScript } from "@/thinking-lab/execution/script";
import {
  isFailedMeaningAudit,
  type ExecutionAuditLesson,
  type ExecutionMeaningAudit,
  type ExecutionPassCheckId,
  type ExecutionRelation,
  type ExecutionSemanticFacts,
  type ExecutionTriState,
} from "@/thinking-lab/execution/types";

export const IMAGE_PASS_CHECK_IDS = [
  "imageShape",
  "hookHolds",
  "soundsSpoken",
  "messageStays",
  "emotionalTone",
  "imagePrompt",
  "imageCaption",
] as const satisfies readonly ExecutionPassCheckId[];

export const IMAGE_EXTRA_CHECK_IDS = ["imageShape", "imagePrompt", "imageCaption"] as const satisfies readonly ExecutionPassCheckId[];

const IMAGE_SLIDE_REPAIR_IDS = [
  "hookHolds",
  "soundsSpoken",
  "messageStays",
  "emotionalTone",
  "imagePrompt",
] as const satisfies readonly ExecutionPassCheckId[];

const RETIRED_IMAGE_RESUME = {
  pillarFits: "messageStays",
  formatHolds: "messageStays",
  mechanismVisible: "messageStays",
  causeChain: "imagePrompt",
  viewerClimb: "imagePrompt",
  imageCopy: "imagePrompt",
} as const satisfies Record<string, (typeof IMAGE_PASS_CHECK_IDS)[number]>;

const UNDECIDED = "This check could not be decided.";

const RELATIONS: Record<(typeof IMAGE_PASS_CHECK_IDS)[number], ExecutionRelation> = {
  imageShape: "FORMAT_MISSED",
  hookHolds: "HOOK_MISSED",
  soundsSpoken: "SPEECH_STIFF",
  messageStays: "MESSAGE_ADDED",
  emotionalTone: "PERSON_MISSED",
  imagePrompt: "FORMAT_MISSED",
  imageCaption: "FORMAT_MISSED",
};

export type ImagePassCheck = {
  id: ExecutionPassCheckId;
  state: "pending" | "running" | "pass" | "fail";
  enabled?: boolean;
  reason?: string;
  lineIds?: string[];
};

export function emptyImagePassChecklist(): ImagePassCheck[] {
  return IMAGE_PASS_CHECK_IDS.map((id) => ({ id, state: "pass" as const, enabled: false }));
}

export function imageChecksFromAudit(audit: ExecutionMeaningAudit | null | undefined): ImagePassCheck[] {
  if (audit && "cleared" in audit) {
    return IMAGE_PASS_CHECK_IDS.map((id) =>
      id === "emotionalTone" || id === "soundsSpoken" ? { id, state: "pass" as const, enabled: false } : { id, state: "pass" as const },
    );
  }
  if (!audit || "cleared" in audit) return parkImageSpeech(emptyImagePassChecklist());
  const resume = RETIRED_IMAGE_RESUME[audit.id as keyof typeof RETIRED_IMAGE_RESUME];
  if (resume) {
    const resumeAt = IMAGE_PASS_CHECK_IDS.indexOf(resume);
    return parkImageSpeech(IMAGE_PASS_CHECK_IDS.map((id, index) => (index < resumeAt ? { id, state: "pass" } : { id, state: "pending" })));
  }
  const failedAt = IMAGE_PASS_CHECK_IDS.indexOf(audit.id as (typeof IMAGE_PASS_CHECK_IDS)[number]);
  const built = IMAGE_PASS_CHECK_IDS.map((id, index) => {
    if (failedAt >= 0 && index < failedAt) return { id, state: "pass" as const };
    if (id === audit.id) return { id, state: "fail" as const, reason: audit.reason, lineIds: audit.lineIds };
    return { id, state: "pending" as const };
  });
  return audit.id === "soundsSpoken" ? built : parkImageSpeech(built);
}

function parkImageSpeech(checks: ImagePassCheck[]): ImagePassCheck[] {
  return checks.map((check) => (check.id === "soundsSpoken" ? { id: "soundsSpoken", state: "pass", enabled: false } : check));
}

function storySlides(script: VoiceOverScript) {
  return script.scenes.filter((scene) => scene.purpose !== "cta" && scene.lines.some((line) => line.narration.trim()));
}

function slideLines(script: VoiceOverScript): Array<{ id: string; narration: string }> {
  return storySlides(script).flatMap((scene) =>
    scene.lines.flatMap((line) => (line.narration.trim() ? [{ id: line.id, narration: line.narration.trim() }] : [])),
  );
}

export function imageSpeechRepairLines(script: VoiceOverScript, lineIds: readonly string[] | undefined): string[] {
  const known = new Set(slideLines(script).map((line) => line.id));
  return [...new Set((lineIds ?? []).filter((id) => known.has(id)))];
}

export function imageSlideRepairLine(
  script: VoiceOverScript,
  lineIds: readonly string[] | undefined,
  reason?: string,
): string | null {
  const slides = slideLines(script);
  if (lineIds && lineIds.length === 1 && slides.some((line) => line.id === lineIds[0])) return lineIds[0] ?? null;
  if (lineIds && lineIds.length > 1) return null;
  const named = slides
    .filter((line) => {
      if (!line.id || !reason) return false;
      const escaped = line.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:$|[^A-Za-z0-9])`).test(reason);
    })
    .map((line) => line.id);
  return named.length === 1 ? named[0] ?? null : null;
}

export function retiredImagePassCheck(id: string): boolean {
  return id in RETIRED_IMAGE_RESUME;
}

export function imageLessons(lessons: readonly ExecutionAuditLesson[] | null | undefined): ExecutionAuditLesson[] {
  return (lessons ?? []).filter((lesson) => !retiredImagePassCheck(lesson.checkId));
}

export function imageResumeReady(facts: ExecutionSemanticFacts): boolean {
  const audit = facts.meaningAudit;
  return Boolean(audit && !("cleared" in audit) && retiredImagePassCheck(audit.id));
}

export function imageRewriteFromFailure(audit: ExecutionMeaningAudit | null | undefined): boolean {
  if (!audit || "cleared" in audit) return false;
  return imageChecksFromAudit(audit).some((check) => check.state === "pass" && check.enabled !== false);
}

export function imageRecheckClaim(checks: readonly ImagePassCheck[]): ImagePassCheck[] {
  return checks.map((check) =>
    check.id === "messageStays" && check.state === "pass" && check.enabled !== false ? { ...check, state: "pending" } : check,
  );
}

export function imageChecksAfterSlideRewrite(checks: readonly ImagePassCheck[], failedId: ExecutionPassCheckId): ImagePassCheck[] {
  const failedAt = IMAGE_PASS_CHECK_IDS.indexOf(failedId as (typeof IMAGE_PASS_CHECK_IDS)[number]);
  return checks.map((check) => {
    const index = IMAGE_PASS_CHECK_IDS.indexOf(check.id as (typeof IMAGE_PASS_CHECK_IDS)[number]);
    if (failedAt >= 0 && index > failedAt && check.state === "pass" && check.enabled !== false) return { ...check, state: "pending" };
    return check;
  });
}

function insertMissingImageCheck(checks: readonly ImagePassCheck[], id: "soundsSpoken" | "emotionalTone"): ImagePassCheck[] {
  if (checks.some((check) => check.id === id)) return checks.map((check) => ({ ...check }));
  const added: ImagePassCheck = { id, state: "pass", enabled: false };
  const at = IMAGE_PASS_CHECK_IDS.indexOf(id);
  let insertAt = checks.length;
  for (let index = 0; index < checks.length; index += 1) {
    const position = IMAGE_PASS_CHECK_IDS.indexOf(checks[index]?.id as (typeof IMAGE_PASS_CHECK_IDS)[number]);
    if (position > at) {
      insertAt = index;
      break;
    }
  }
  return [...checks.slice(0, insertAt).map((check) => ({ ...check })), added, ...checks.slice(insertAt).map((check) => ({ ...check }))];
}

export function ensureImageEmotionalTone(checks: readonly ImagePassCheck[]): ImagePassCheck[] {
  return insertMissingImageCheck(checks, "emotionalTone");
}

export function ensureImageSoundsSpoken(checks: readonly ImagePassCheck[]): ImagePassCheck[] {
  return insertMissingImageCheck(checks, "soundsSpoken");
}

export function ensureImageLegacySwitches(checks: readonly ImagePassCheck[]): ImagePassCheck[] {
  return ensureImageSoundsSpoken(ensureImageEmotionalTone(checks));
}

export function imageSlideRepairReady(facts: ExecutionSemanticFacts, script: VoiceOverScript): boolean {
  if (script.medium !== "image" || !script.image) return false;
  const audit = facts.meaningAudit;
  if (!isFailedMeaningAudit(audit)) return false;
  if (!IMAGE_SLIDE_REPAIR_IDS.some((id) => id === audit.id)) return false;
  if (audit.id === "emotionalTone" && script.image.format === "single" && audit.lineIds.length === 1 && audit.lineIds[0] === "caption") {
    return true;
  }
  if (audit.id === "soundsSpoken" && imageSpeechRepairLines(script, audit.lineIds).length > 0) return true;
  return imageSlideRepairLine(script, audit.lineIds, audit.reason) !== null;
}

export function imageFailureMoved(before: ExecutionPassCheckId, checks: readonly ImagePassCheck[]): boolean {
  const next = checks.find((check) => check.state === "fail");
  if (!next) return false;
  return IMAGE_PASS_CHECK_IDS.indexOf(next.id as (typeof IMAGE_PASS_CHECK_IDS)[number]) > IMAGE_PASS_CHECK_IDS.indexOf(before as (typeof IMAGE_PASS_CHECK_IDS)[number]);
}

export function judgeImageShape(script: VoiceOverScript, settings: ImageSettings): { pass: true } | { pass: false; reason: string } {
  const count = storySlides(script).length;
  const oneLine = storySlides(script).every((scene) => scene.lines.filter((line) => line.narration.trim()).length === 1);
  if (!oneLine) return { pass: false, reason: "Each slide needs one copy line." };
  if (settings.format === "single") {
    return count === 1 ? { pass: true } : { pass: false, reason: "A single image needs one slide." };
  }
  if (settings.slideCountMode === "manual" && settings.slideCount) {
    return count === settings.slideCount
      ? { pass: true }
      : { pass: false, reason: `This carousel needs ${settings.slideCount} slides.` };
  }
  return count >= 2 && count <= 10 ? { pass: true } : { pass: false, reason: "A carousel decided from the Idea needs 2 to 10 slides." };
}

function judgeImagePromptShape(script: VoiceOverScript, settings: ImageSettings): { pass: true } | { pass: false; reason: string } {
  const slides = storySlides(script);
  if (!settings.withImage) {
    const hasPrompt = slides.some((scene) => scene.lines.some((line) => line.shots.some((shot) => shot.prompt.trim())));
    return hasPrompt ? { pass: false, reason: "Copy only does not take an image prompt." } : { pass: true };
  }
  const missing = slides.some((scene) => scene.lines.some((line) => line.shots.filter((shot) => shot.prompt.trim()).length !== 1));
  return missing ? { pass: false, reason: "Each slide needs one image prompt." } : { pass: true };
}

function lineBlock(lines: Array<{ id: string; narration: string }>): string[] {
  if (lines.length === 0) return ["(none)"];
  return lines.map((line) => `${line.id}: ${line.narration}`);
}

export function buildImagePassPrompt(input: {
  id: ExecutionPassCheckId;
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  image: ImageSettings;
}): string {
  const slides = slideLines(input.script);
  const first = slides[0] ? [slides[0]] : [];
  const single = input.image.format === "single";
  const lines =
    input.id === "hookHolds"
      ? first
      : input.id === "emotionalTone" && single
        ? [...slides, { id: "caption", narration: input.script.caption.trim() }]
          : input.id === "emotionalTone"
          ? slides
          : input.id === "imageCaption"
                ? [{ id: "caption", narration: input.script.caption.trim() }]
                : input.id === "imagePrompt"
                  ? storySlides(input.script).flatMap((scene) =>
                      scene.lines.flatMap((line) =>
                        line.shots.map((shot) => ({ id: line.id, narration: `${line.narration}\nPrompt: ${shot.prompt}` })),
                      ),
                    )
                  : slides;
  const rule =
    input.id === "hookHolds"
      ? [
          "This copy is the first slide.",
          "pass is true only when a stranger who reads only this slide can tell what situation they are in.",
          "The copy uses this pillar's format. A list opens as a list. A story opens as a story. A question is allowed when that shape is this pillar's format.",
          "The problem is not answered yet. Later slides carry the problem.",
          "A short slide may show only the situation. Do not fail because the sentence still makes sense if the Idea's problem is removed.",
        ]
      : input.id === "soundsSpoken"
        ? [
            "These lines are the slide narrations.",
            "pass is true when a stranger who does not work in this field can read the line out loud and it still sounds like someone talking.",
            "Everyday words are enough. The line does not need this field's special terms.",
            ...everydaySpeechJudgeRules("image"),
            "pass is false when the line reads like a report, a definition, or a brochure.",
            "pass is false when a stranger outside this field must know this field's special terms to understand it.",
            "The pillar's list or story shape can stay. The wording of that line still has to be everyday speech.",
            "Do not fail because the line follows this pillar's shape. The pillar's name inside the narration is not that shape.",
            "Do not put the slide label inside the narration.",
            "Do not fail because the person has not appeared yet. Another check judges that.",
            "Do not fail because the line adds a claim. Another check judges that.",
            "Name the line id that fails.",
          ]
        : input.id === "messageStays"
        ? [
            "pass is false when a slide adds a solution, a product, a brand, a company, a service, or a consequence the Idea does not carry.",
            "Name that slide's line id.",
            "Do not fail a slide only because it states the Idea.",
            "Do not fail a slide only because it uses this pillar's format.",
            ...claimMaterialLines({ pillarDevelopment: input.pillarDevelopment, decisions: input.script.decisions }),
          ]
        : input.id === "emotionalTone"
          ? single
            ? [
                "The slide does not have to be that person. The caption is where we see what happens to someone.",
                "pass is true when the caption shows the person it happens to.",
                "That is someone living what the Idea below already says. They do not need a name, a job, or their own scene.",
                "A short point that says what happens to them passes, even when it also says how it works.",
                "Do not require a named person. Do not require a zero record, a closed count, or any detail the Idea below does not need.",
                "pass is false only when the caption never shows anyone it happens to.",
                "pass is false when the only person is the speaker asking how it works.",
                "Someone who says saya berpikir or saya sadar is not that person.",
                "pass is false when that person brings a product, a brand, a company, or a fix the Idea below does not already have.",
                "Name the caption id when the caption still shows no one it happens to.",
                "Do not fail because the words are calm, because the caption says the Idea, or because the slide follows this pillar's shape.",
              ]
            : [
                "pass is true when the slides show the person it happens to.",
                "That is someone living what the Idea below already says. They do not need a name, a job, or their own scene. One item in a list can be that person.",
                "A short line that says what happens to them passes, even when the same line also says how it works.",
                "The first slide does not have to be that person.",
                "Do not require a named person. Do not require a zero record, a closed count, or any detail the Idea below does not need.",
                "pass is false only when no slide shows anyone it happens to.",
                "pass is false when the only person is the speaker asking how it works.",
                "Someone who says saya berpikir or saya sadar is not that person.",
                "pass is false when that person brings a product, a brand, a company, or a fix the Idea below does not already have.",
                "Name the line id that still shows no one it happens to.",
                "Do not fail because the words are calm, because a slide says the Idea, or because the slide follows this pillar's shape.",
              ]
          : input.id === "imagePrompt"
                        ? [
                            "Each block is one slide. The narration is the script on that slide. The prompt is what the user pastes into an image generator.",
                            "pass is true when the prompt visualizes the context of that narration.",
                            "pass is false when the prompt does not show the context of that slide.",
                          ]
                        : [
                            "This is the post caption.",
                            "pass is true when the caption does not copy the slides, uses a few short points, and ends with hashtags.",
                            "pass is false when the caption pastes the slides or has no hashtags.",
                          ];
  return [
    "Decide one image pass check. Do not rewrite the slides.",
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
    ...lineBlock(lines),
  ].join("\n");
}

export function buildImageSlideRepairPrompt(input: {
  id: ExecutionPassCheckId;
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  image: ImageSettings;
  lineId: string;
  reason: string;
  lessons?: readonly ExecutionAuditLesson[] | null;
}): string {
  const slides = slideLines(input.script);
  const current = input.script.scenes.flatMap((scene) => scene.lines).find((line) => line.id === input.lineId);
  const prompt = current?.shots.find((shot) => shot.prompt.trim())?.prompt.trim() ?? "";
  const others = slides.filter((line) => line.id !== input.lineId);
  const lessons = input.lessons ?? [];
  const captionRepair = input.lineId === "caption";
  return [
    captionRepair ? "Rewrite only the caption." : "Rewrite only this slide.",
    captionRepair ? "Do not change the slides." : "Do not change the other slides, the caption, or the number of slides.",
    "A slide may state the Idea. That is not a repeated point.",
    "This slide must not say the same point as another slide. The format's opening word may stay the same.",
    `This failure is ${input.id}: ${input.reason}`,
    ...(input.id === "hookHolds"
      ? [
          "This is the first slide.",
          "A stranger who reads only this slide knows the situation.",
          "The slide may show only the situation and does not have to contain the whole problem.",
          "The problem stays unanswered. Keep this pillar's format.",
        ]
      : []),
    ...(input.id === "soundsSpoken"
      ? [
          "Rewrite this slide as everyday speech. More than one short sentence may stay on this slide.",
          ...everydaySpeechWriterRules("image"),
          "Say what this slide means in everyday words. Do not copy the Idea's special terms.",
          "A stranger outside this field can read it out loud.",
          "Do not write a report, a definition, or a brochure.",
          "Keep this pillar's format.",
          "Do not put the slide label inside the narration.",
        ]
      : []),
    ...(input.id === "messageStays"
      ? [
          "Remove the product, brand, company, and any solution the Idea does not carry.",
          "Keep one part of the Idea. Do not offer a service.",
          "Remove a situation, a desire, a need, or a consequence that is not in the Idea and not in the locked material.",
          "Keep a detail that the locked pillar communication or a locked story answer already names.",
          ...claimMaterialLines({ pillarDevelopment: input.pillarDevelopment, decisions: input.script.decisions }),
        ]
      : []),
    ...(input.id === "emotionalTone"
      ? captionRepair
        ? [
            "Show someone it happens to. They do not need a name or their own scene. The caption may also say how it works.",
            "Do not leave the caption as someone asking how it works.",
            "Keep the caption as a few short points and end with hashtags.",
            "Do not add a claim, a product, a brand, a company, or a solution the Idea does not carry.",
          ]
        : [
            "Show someone it happens to on this slide. They do not need a name or their own scene. The line may also say how it works.",
            "Do not leave the slide as someone asking how it works.",
            "Keep this pillar's format.",
            "Do not add a claim, a product, a brand, a company, or a solution the Idea does not carry.",
          ]
      : []),
    ...(input.id === "imagePrompt"
      ? [
          "Keep the narration exactly.",
          "Replace only the image prompt. Visualize the context of that narration. A person can paste the prompt into an image generator.",
        ]
      : []),
    captionRepair
      ? "Return the caption as narration. Leave the prompt empty."
      : input.image.withImage
        ? "Return the narration as everyday speech, and one image prompt. More than one short sentence may stay. The prompt visualizes the context of that narration. Do not put the slide label inside the narration."
        : "Return the narration as everyday speech. More than one short sentence may stay. Do not put the slide label inside the narration. Do not write an image prompt.",
    "Do not repeat a line listed under the earlier failures.",
    'Return JSON only: {"lines":[{"lineId":"...","narration":"...","prompt":"..."}]}',
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
    "Other slides. Leave these unchanged:",
    ...lineBlock(others),
    "",
    "Earlier failures. Do not repeat these lines or this mistake:",
    ...(lessons.length === 0
      ? ["(none)"]
      : lessons.map((lesson) => `${lesson.checkId}: ${lesson.lines.join(" / ")}\nWhy it failed: ${lesson.reason}`)),
    "",
    captionRepair ? "Caption to rewrite:" : "Slide to rewrite:",
    captionRepair ? input.script.caption.trim() : `${input.lineId}: ${current?.narration.trim() ?? ""}`,
    ...(prompt ? [`Prompt: ${prompt}`] : []),
  ].join("\n");
}

export function buildImageSpeechRepairPrompt(input: {
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  script: VoiceOverScript;
  image: ImageSettings;
  lineIds: readonly string[];
  reason: string;
  lessons?: readonly ExecutionAuditLesson[] | null;
}): string {
  const wanted = new Set(input.lineIds);
  const slides = slideLines(input.script);
  const targets = slides.filter((line) => wanted.has(line.id));
  const others = slides.filter((line) => !wanted.has(line.id));
  const lessons = input.lessons ?? [];
  return [
    "Rewrite every named slide narration.",
    "Do not change the other slides, the caption, or the number of slides.",
    "A slide may state the Idea. That is not a repeated point.",
    "This slide must not say the same point as another slide. The format's opening word may stay the same.",
    `This failure is soundsSpoken: ${input.reason}`,
    "Say what each slide means in everyday words. Do not copy the Idea's special terms.",
    "More than one short sentence may stay on a slide.",
    ...everydaySpeechWriterRules("image"),
    "A stranger outside this field can read it out loud.",
    "Do not write a report, a definition, or a brochure.",
    "Keep this pillar's format.",
    "Do not put the slide label inside the narration.",
    input.image.withImage
      ? "Return each narration as everyday speech, and one image prompt. The prompt visualizes the context of that narration."
      : "Return each narration as everyday speech. Leave the prompt empty.",
    "Do not repeat a line listed under the earlier failures.",
    'Return JSON only: {"lines":[{"lineId":"...","narration":"...","prompt":"..."}]}',
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
    "Other slides. Leave these unchanged:",
    ...lineBlock(others),
    "",
    "Earlier failures. Do not repeat these lines or this mistake:",
    ...(lessons.length === 0
      ? ["(none)"]
      : lessons.map((lesson) => `${lesson.checkId}: ${lesson.lines.join(" / ")}\nWhy it failed: ${lesson.reason}`)),
    "",
    "Slides to rewrite:",
    ...targets.map((line) => `${line.id}: ${line.narration}`),
  ].join("\n");
}

export function parseImageSpeechRepairs(raw: unknown): Array<{ lineId: string; narration: string; prompt: string }> {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { lines?: unknown }).lines : raw;
  if (!Array.isArray(row)) return [];
  return row.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const line = item as { lineId?: unknown; id?: unknown; narration?: unknown; prompt?: unknown };
    const lineId = typeof line.lineId === "string" ? line.lineId.trim() : typeof line.id === "string" ? line.id.trim() : "";
    const narration = typeof line.narration === "string" ? line.narration.trim() : "";
    const prompt = typeof line.prompt === "string" ? line.prompt.trim() : "";
    if (!lineId || !narration) return [];
    return [{ lineId, narration, prompt }];
  });
}

export function parseImageSlideRepair(raw: unknown): { lineId: string; narration: string; prompt: string } | null {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { lines?: unknown }).lines : raw;
  if (!Array.isArray(row)) return null;
  const item = row.find((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  if (!item || typeof item !== "object") return null;
  const line = item as { lineId?: unknown; id?: unknown; narration?: unknown; prompt?: unknown };
  const lineId = typeof line.lineId === "string" ? line.lineId.trim() : typeof line.id === "string" ? line.id.trim() : "";
  const narration = typeof line.narration === "string" ? line.narration.trim() : "";
  const prompt = typeof line.prompt === "string" ? line.prompt.trim() : "";
  if (!lineId || !narration) return null;
  return { lineId, narration, prompt };
}

export function mergeImageSlideRepair(
  script: VoiceOverScript,
  replacement: { lineId: string; narration: string; prompt: string },
  settings: ImageSettings,
): VoiceOverScript {
  const narration = replacement.narration.trim();
  const prompt = replacement.prompt.trim();
  const next: VoiceOverScript = {
    ...script,
    scenes: script.scenes.map((scene) => ({
      ...scene,
      lines: scene.lines.map((line) => {
        if (line.id !== replacement.lineId || !narration) return line;
        if (!settings.withImage) return { ...line, narration, shots: [] };
        if (!prompt) return { ...line, narration };
        const shot = line.shots[0];
        return {
          ...line,
          narration,
          shots: [
            {
              id: shot?.id ?? `${line.id}-h1`,
              role: shot?.role || "Image",
              angle: shot?.angle ?? "",
              visualFunction: shot?.visualFunction ?? "",
              prompt,
            },
          ],
        };
      }),
    })),
  };
  return { ...script, ...next, medium: "image", image: settings };
}

export function imageFactsFromChecks(input: {
  pillar: string;
  checks: readonly ImagePassCheck[];
  masterSells: ExecutionTriState;
  auditLessons?: ExecutionAuditLesson[];
}): ExecutionSemanticFacts {
  const failed = input.checks.find((check) => check.enabled !== false && check.state === "fail");
  const undecided = failed?.reason === UNDECIDED;
  const relation: ExecutionRelation = !failed
    ? "VALID_EXECUTION"
    : undecided
      ? "UNRESOLVED"
      : RELATIONS[failed.id as (typeof IMAGE_PASS_CHECK_IDS)[number]] ?? "FORMAT_MISSED";
  const meaningAudit: ExecutionMeaningAudit = !failed
    ? { cleared: true }
    : { id: failed.id, reason: failed.reason ?? UNDECIDED, lineIds: failed.lineIds ?? [] };
  return {
    pillar: input.pillar,
    whatItSays: failed?.reason ?? "",
    relationToParent: relation,
    messageAdded: failed?.id === "messageStays" && !undecided ? true : false,
    mechanismVisible: true,
    pillarOutside: false,
    masterSells: input.masterSells,
    viewerClimb: "CLIMBS",
    subjectMatch: "MATCH",
    resolution: relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED",
    unresolvedReasons: relation === "UNRESOLVED" ? ["CHECK_UNDECIDED"] : [],
    meaningAudit,
    auditLessons: input.auditLessons ?? [],
    passChecks: storedPassChecks(input.checks),
  };
}

export async function runImageOpenChecks(input: {
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  image: ImageSettings;
  masterSells: ExecutionTriState;
  auditLessons?: ExecutionAuditLesson[];
  prior?: readonly ImagePassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: ImagePassCheck[]) => void;
}): Promise<{ checks: ImagePassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  const checks = emptyImagePassChecklist().map((check) => {
    const previous = input.prior?.find((item) => item.id === check.id);
    if (!previous) return { ...check };
    if (previous.enabled === false) return { id: check.id, state: "pass" as const, enabled: false };
    return previous.state === "pass"
      ? { id: check.id, state: "pass" as const, enabled: true }
      : { id: check.id, state: "pending" as const, enabled: true };
  });
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  for (const id of IMAGE_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.enabled === false || checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "imageShape") {
      const shape = judgeImageShape(input.script, input.image);
      checks[index] = shape.pass ? { id, state: "pass" } : { id, state: "fail", reason: shape.reason, lineIds: [] };
      publish();
      if (!shape.pass) break;
      continue;
    }
    if (id === "imagePrompt") {
      const shape = judgeImagePromptShape(input.script, input.image);
      if (!shape.pass || !input.image.withImage) {
        checks[index] = shape.pass ? { id, state: "pass" } : { id, state: "fail", reason: shape.reason, lineIds: [] };
        publish();
        if (!shape.pass) break;
        continue;
      }
    }
    if (id === "imageCaption" && (!input.script.caption.trim() || !input.script.caption.includes("#"))) {
      checks[index] = { id, state: "fail", reason: "The caption needs short points and hashtags.", lineIds: [] };
      publish();
      break;
    }
    const known = new Set([
      ...slideLines(input.script).map((line) => line.id),
      "caption",
    ]);
    const parsed = parseExecutionPassCheck(
      await input.ask(
        buildImagePassPrompt({
          id,
          pillar: input.pillar,
          pillarCategory: input.pillarCategory,
          pillarDescription: input.pillarDescription,
          masterStatement: input.masterStatement,
          ideaStatement: input.ideaStatement,
          ancestors: input.ancestors,
          pillarDevelopment: input.pillarDevelopment,
          script: input.script,
          image: input.image,
        }),
      ),
      known,
    );
    if (!parsed.pass) {
      const lineIds = parsed.lineIds;
      const unnamedPerson = id === "emotionalTone" && (parsed.reason === UNDECIDED || lineIds.length === 0);
      checks[index] = {
        id,
        state: "fail",
        reason: parsed.reason,
        lineIds: unnamedPerson ? [] : lineIds,
      };
      publish();
      break;
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  const facts = imageFactsFromChecks({
    pillar: input.pillar,
    checks,
    masterSells: input.masterSells === "unresolved" ? "unresolved" : input.masterSells,
    auditLessons: input.auditLessons,
  });
  return { checks: checks.map((check) => ({ ...check })), passed: facts.relationToParent === "VALID_EXECUTION", facts };
}

export async function runImageMeaningChecks(
  input: Parameters<typeof runImageOpenChecks>[0],
): Promise<{ checks: ImagePassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  return runImageOpenChecks(input);
}
