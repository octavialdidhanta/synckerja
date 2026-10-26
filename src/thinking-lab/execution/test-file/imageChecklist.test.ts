import { describe, expect, it, vi } from "vitest";
import { buildImageGeneratePrompt } from "@/thinking-lab/execution/imageGenerate";
import {
  buildImagePassPrompt,
  buildImageSlideRepairPrompt,
  buildImageSpeechRepairPrompt,
  ensureImageLegacySwitches,
  imageSpeechRepairLines,
  parseImageSpeechRepairs,
  IMAGE_PASS_CHECK_IDS,
  imageChecksFromAudit,
  imageRewriteFromFailure,
  imageSlideRepairReady,
  judgeImageShape,
  runImageMeaningChecks,
  runImageOpenChecks,
} from "@/thinking-lab/execution/imageChecklist";
import { lessonFromMeaningAudit, regeneratePassPrior } from "@/thinking-lab/execution/passChecklist";
import { buildPlanScript, parseVoiceOverScript, stampImageScript, type VoiceOverScript } from "@/thinking-lab/execution/script";

const settings = { format: "carousel" as const, slideCountMode: "manual" as const, slideCount: 2, withImage: true };
const imageChecksOn = IMAGE_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" as const, enabled: true }));

function script(): VoiceOverScript {
  return stampImageScript(
    {
      title: "Judul",
      caption: "✨ Satu hal.\n#Evaluasi",
      assets: { locations: [], characters: [], properties: [] },
      scenes: [
        {
          id: "s1",
          title: "Slide 1",
          lines: [{ id: "s1-l1", narration: "Stop mengukur terlambat.\nEvaluasi minggu ini kosong.", shots: [{ id: "h", role: "Image", angle: "", visualFunction: "", prompt: "A calendar with an empty week." }] }],
        },
        {
          id: "s2",
          title: "Slide 2",
          lines: [{ id: "s2-l1", narration: "Nilainya baru kelihatan nanti.\nItu sebab angkanya diam.", shots: [{ id: "h2", role: "Image", angle: "", visualFunction: "", prompt: "A quiet scoreboard." }] }],
        },
      ],
      lineIssues: [],
      audio: { sound: false, music: false },
    },
    settings,
  );
}

describe("image execution", () => {
  it("asks the first slide to open and the last slide to land", () => {
    const prompt = buildImageGeneratePrompt({
      masterStatement: "Nilai strategis baru kelihatan setelah jendela evaluasi.",
      ideaStatement: "Kontribusi kualitatif tidak terukur di dalam jendela evaluasi.",
      pillar: "Education - The 'Stop Doing This'",
      image: settings,
      enabled: ["hookHolds", "soundsSpoken", "messageStays", "emotionalTone"],
    });
    expect(prompt).toContain("Write exactly 2 slides.");
    expect(prompt).toContain("Slide 1 - short label");
    expect(prompt).toContain("A slide may hold more than one short sentence.");
    expect(prompt).toContain("Do not copy the Idea's special terms.");
    expect(prompt).toContain("what a person does");
    expect(prompt).toContain("Do not write a calm report.");
    expect(prompt).not.toContain("kontribusi kolektif");
    expect(prompt).toContain("Do not put the slide label inside the narration.");
    expect(prompt).not.toContain("The narration is one sentence of the script.");
    expect(prompt).not.toContain("The first line of the narration is the headline.");
    expect(prompt).toContain("The prompt visualizes the context of that slide's narration.");
    expect(prompt).not.toContain("Do not draw the headline as text inside the image.");
    expect(prompt).toContain("Each list item says a different part of the Idea.");
    expect(prompt).not.toContain("A second sentence fails.");
    expect(prompt).not.toContain("imageCopy");
    expect(prompt).not.toContain("The cause is the Big Thought's stake");
    expect(prompt).not.toContain("climbs from the mechanism");
    expect(prompt).toContain("One slide may carry one part of the Idea.");
    expect(prompt).not.toContain("keep the experiment, the condition, and the consequence");
    expect(prompt).toContain("Do not name a product, a brand, or a company.");
    expect(prompt).toContain("They do not need a name or their own scene.");
    expect(prompt).toContain("The first slide does not have to be that person.");
    expect(prompt).not.toContain("can only set the scene");
    expect(prompt).not.toContain("emotionalTone");
    const claim = buildImagePassPrompt({
      id: "messageStays",
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Kontribusi kualitatif tidak terukur.",
      script: script(),
      image: settings,
    });
    expect(claim).toContain("a solution, a product, a brand, a company, a service, or a consequence the Idea does not carry");
    expect(claim).not.toContain("add no claim the Idea does not carry");
    expect(claim).not.toContain("One slide may carry one part of the Idea.");
    expect(claim).not.toContain("find talent");
    expect(claim).toContain("Do not fail a slide only because it states the Idea.");
    expect(claim).toContain("Name that slide's line id.");
    expect(claim).not.toContain("Locked pillar communication:");
    const bounded = buildImagePassPrompt({
      id: "messageStays",
      pillar: "Letter to Younger Self",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Kontribusi kualitatif tidak terukur.",
      pillarDevelopment: "Tanyakan satu hal kecil sebelum les tambahan.",
      script: {
        ...script(),
        decisions: [
          { category: "Momen", question: "Apa yang terlihat?", answer: "Anak sedang bermain game.", binds: "story" },
          { category: "Sudut", question: "Siapa yang berbicara?", answer: "Ibu yang lebih tua.", binds: "viewpoint" },
        ],
      },
      image: settings,
    });
    expect(bounded).toContain("Tanyakan satu hal kecil sebelum les tambahan.");
    expect(bounded).toContain("Anak sedang bermain game.");
    expect(bounded).not.toContain("Ibu yang lebih tua.");
    expect(bounded).toContain("andai saja aku tahu");
    expect(bounded).toContain("ibu yang baik sedunia");
    const slideRepair = buildImageSlideRepairPrompt({
      id: "messageStays",
      pillar: "Letter to Younger Self",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Kontribusi kualitatif tidak terukur.",
      pillarDevelopment: "Tanyakan satu hal kecil sebelum les tambahan.",
      script: script(),
      image: settings,
      lineId: "s1-l1",
      reason: "Ada klaim baru.",
    });
    expect(slideRepair).toContain("saat itu aku mulai bertanya");
    expect(slideRepair).toContain("A smile, or the words ibu yang baik sedunia, is a new claim");
    const opening = buildImagePassPrompt({
      id: "hookHolds",
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
    });
    expect(opening).toContain("first slide");
    expect(opening).toContain("Do not fail because the sentence still makes sense if the Idea's problem is removed.");
    expect(opening).toContain("Later slides carry the problem.");
    expect(opening).toContain("A short slide may show only the situation.");
    expect(opening).not.toContain("pass is false when a stranger cannot tell the situation.");
    expect(opening).not.toContain("pass is false when the opening uses a different format from the pillar.");
    expect(opening).not.toContain("sounds like someone talking");
    const picture = buildImagePassPrompt({
      id: "imagePrompt",
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
    });
    expect(picture).toContain("pass is true when the prompt visualizes the context of that narration.");
    expect(picture).not.toContain("headline");
  });

  it("rejects the wrong slide count without a model and keeps the Veo prompt in the plan", async () => {
    expect(judgeImageShape(script(), { ...settings, slideCount: 4 })).toEqual({
      pass: false,
      reason: "This carousel needs 4 slides.",
    });
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const result = await runImageMeaningChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: { ...settings, slideCount: 4 },
      masterSells: false,
      prior: imageChecksOn,
      ask,
      onStep: () => undefined,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(result.checks.find((check) => check.id === "imageShape")?.state).toBe("fail");
    expect(result.checks.find((check) => check.id === "hookHolds")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "soundsSpoken")?.state).toBe("pending");
    const plan = buildPlanScript(script());
    expect(plan).toContain("A calendar with an empty week.");
    expect(plan).toContain("Stop mengukur terlambat.");
    expect(plan).not.toContain("Audio :");
    const stored = parseVoiceOverScript(script());
    expect(stored?.medium).toBe("image");
    expect(stored?.image?.withImage).toBe(true);
  });

  it("rejects an image prompt when the setting is copy only", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const result = await runImageMeaningChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: { ...settings, withImage: false },
      masterSells: false,
      prior: imageChecksOn,
      ask,
      onStep: () => undefined,
    });
    expect(result.checks.find((check) => check.id === "imagePrompt")).toMatchObject({
      state: "fail",
      reason: "Copy only does not take an image prompt.",
    });
    expect(result.checks.find((check) => check.id === "imageCaption")?.state).toBe("pending");
  });

  it("does not ask image slides to pass the spoken-format check", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const result = await runImageMeaningChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
      masterSells: false,
      prior: imageChecksOn,
      ask,
      onStep: () => undefined,
    });
    expect(result.checks.some((check) => check.id === "formatHolds")).toBe(false);
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("two slides say the same point"))).toBe(false);
    const resumed = imageChecksFromAudit({
      id: "formatHolds",
      reason: "Slide s2-l1 mengulang.",
      lineIds: ["s2-l1"],
    });
    expect(resumed.some((check) => check.id === "formatHolds")).toBe(false);
    expect(resumed.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(resumed.find((check) => check.id === "messageStays")?.state).toBe("pending");
  });

  it("continues an image audit from the failed check", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("first slide")) return '{"pass":false,"reason":"should not be asked","lineIds":["s1-l1"]}';
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const prior = [
      { id: "imageShape" as const, state: "pass" as const },
      { id: "hookHolds" as const, state: "pass" as const },
      { id: "pillarFits" as const, state: "pass" as const },
      { id: "formatHolds" as const, state: "fail" as const, reason: "Slide s2-l1 mengulang.", lineIds: ["s2-l1"] },
    ];
    const result = await runImageOpenChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
      masterSells: false,
      prior,
      ask,
      onStep: () => undefined,
    });
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("This copy is the first slide."))).toBe(false);
    expect(result.checks.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(result.checks.some((check) => check.id === "formatHolds")).toBe(false);
    expect(result.checks.find((check) => check.id === "imageShape")?.state).toBe("pass");
    expect(result.checks.some((check) => check.id === "pillarFits" || check.id === "viewerClimb")).toBe(false);
  });

  it("resumes after a retired image check without asking it again", () => {
    const copy = imageChecksFromAudit({
      id: "imageCopy",
      reason: "Slide memiliki kalimat kedua.",
      lineIds: ["s2-l1"],
    });
    expect(copy.some((check) => check.id === "imageCopy")).toBe(false);
    expect(copy.find((check) => check.id === "emotionalTone")?.state).toBe("pass");
    expect(copy.find((check) => check.id === "imagePrompt")?.state).toBe("pending");
    const pillar = imageChecksFromAudit({
      id: "pillarFits",
      reason: "Pilar memaksa pesan di luar Idea.",
      lineIds: [],
    });
    expect(pillar.some((check) => check.id === "pillarFits" || check.id === "viewerClimb" || check.id === "causeChain")).toBe(false);
    expect(pillar.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(pillar.some((check) => check.id === "formatHolds")).toBe(false);
    expect(pillar.find((check) => check.id === "messageStays")?.state).toBe("pending");
    const promptFailure = imageChecksFromAudit({
      id: "imagePrompt",
      reason: "This check could not be decided.",
      lineIds: [],
    });
    expect(imageRewriteFromFailure(promptFailure[0] ? { id: "imagePrompt", reason: "This check could not be decided.", lineIds: [] } : null)).toBe(true);
    expect(promptFailure.find((check) => check.id === "emotionalTone")?.state).toBe("pass");
    expect(promptFailure.find((check) => check.id === "imagePrompt")?.state).toBe("fail");
    expect(promptFailure.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(imageRewriteFromFailure({ id: "imageShape", reason: "A carousel needs 2 slides.", lineIds: [] })).toBe(false);
  });

  it("does not ask a requirement that is switched off", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const result = await runImageOpenChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
      masterSells: false,
      prior: [
        { id: "imageShape", state: "pass" },
        { id: "hookHolds", state: "pass" },
        { id: "messageStays", state: "pass" },
        { id: "imagePrompt", state: "pending" },
        { id: "imageCaption", state: "pending" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("This copy is the last slide."))).toBe(false);
    expect(result.checks.find((check) => check.id === "hookHolds")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "imagePrompt")?.state).toBe("pass");
  });

  it("rechecks a switch that was turned on and skips a switch that was turned off", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":"","lineIds":[]}');
    const prior = regeneratePassPrior([
      { id: "imageShape", state: "pass", enabled: true },
      { id: "hookHolds", state: "pass", enabled: false },
      { id: "messageStays", state: "fail", enabled: true, reason: "Lama." },
      { id: "emotionalTone", state: "pass", enabled: true },
    ]);
    const result = await runImageOpenChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
      masterSells: false,
      prior,
      ask,
      onStep: () => undefined,
    });
    const asked = ask.mock.calls.map(([prompt]) => String(prompt));
    expect(asked.some((prompt) => prompt.includes("This copy is the first slide."))).toBe(false);
    expect(asked.some((prompt) => prompt.includes("This copy is the last slide."))).toBe(false);
    expect(asked.some((prompt) => prompt.includes("the person it happens to"))).toBe(true);
    expect(asked.some((prompt) => prompt.includes("a solution, a product"))).toBe(true);
    expect(result.checks.find((check) => check.id === "hookHolds")).toMatchObject({ enabled: false });
    expect(result.checks.map((check) => check.id).join(" ")).not.toContain("conclusionLands");
    expect(result.checks.find((check) => check.id === "emotionalTone")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "messageStays")?.state).toBe("pass");
  });

  it("checks the person on the consequence slide, and in the caption of a single image", () => {
    const carousel = buildImagePassPrompt({
      id: "emotionalTone",
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
    });
    expect(carousel).toContain("even when the same line also says how it works");
    expect(carousel).toContain("Do not require a named person.");
    expect(carousel).not.toContain("only explain how it works");
    expect(carousel).toContain("Someone who says saya berpikir or saya sadar is not that person.");
    expect(carousel).not.toContain("bagaimana saya mengukur");
    expect(carousel).not.toContain("how to enter a number");
    expect(carousel).not.toContain("The caption carries the consequence.");
    const single = buildImagePassPrompt({
      id: "emotionalTone",
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: { ...settings, format: "single", slideCount: null },
    });
    expect(single).toContain("The caption is where we see what happens to someone.");
    expect(single).toContain("caption:");
    const repair = buildImageSlideRepairPrompt({
      id: "emotionalTone",
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
      lineId: "s2-l1",
      reason: "Slide hanya menjelaskan sistem.",
    });
    expect(repair).toContain("Do not leave the slide as someone asking how it works.");
    const speech = buildImageSpeechRepairPrompt({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Kontribusi strategis kualitatif tidak terukur.",
      script: script(),
      image: settings,
      lineIds: ["s1-l1", "s2-l1"],
      reason: "Ada istilah khusus.",
    });
    expect(imageSpeechRepairLines(script(), ["s1-l1", "s2-l1", "missing"])).toEqual(["s1-l1", "s2-l1"]);
    expect(speech).toContain("Rewrite every named slide narration.");
    expect(speech).toContain("Do not copy the Idea's special terms.");
    expect(speech).toContain("An invitation on a slide is one spoken invitation.");
    expect(speech).toContain("Do not write a formal address or a list of what a product can do");
    expect(speech).not.toContain("the person it happens to");
    const spoken = buildImagePassPrompt({
      id: "soundsSpoken",
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: script(),
      image: settings,
    });
    expect(spoken).toContain("more than one short sentence about the same thing");
    expect(spoken).toContain("explains, defines, or interprets the sign");
    expect(spoken).toContain("sounds like a presentation");
    expect(spoken).toContain("A calm sentence still fails when it reads like a report.");
    expect(spoken).not.toContain("A list item or a story line can pass");
    expect(spoken).not.toContain("Do not fail the closing slide because it names a product");
    expect(spoken).toContain("Do not put the slide label inside the narration.");
    expect(spoken).not.toContain("the person it happens to");
    expect(speech).toContain("s1-l1: Stop mengukur terlambat.");
    expect(speech).toContain("s2-l1: Nilainya baru kelihatan nanti.");
    const ready = imageSlideRepairReady(
      {
        pillar: "Education - The 'Stop Doing This'",
        whatItSays: "",
        relationToParent: "SPEECH_STIFF",
        messageAdded: false,
        mechanismVisible: true,
        pillarOutside: false,
        masterSells: false,
        viewerClimb: "CLIMBS",
        subjectMatch: "MATCH",
        resolution: "RESOLVED",
        unresolvedReasons: [],
        meaningAudit: { id: "soundsSpoken", reason: "Ada istilah khusus.", lineIds: ["s1-l1", "s2-l1"] },
      },
      script(),
    );
    expect(ready).toBe(true);
    expect(parseImageSpeechRepairs({
      lines: [
        { lineId: "s1-l1", narration: "Berhenti mengukur terlambat.", prompt: "A calendar." },
        { lineId: "s2-l1", narration: "Angkanya diam karena hasilnya belum kelihatan.", prompt: "" },
      ],
    }).map((line) => line.lineId)).toEqual(["s1-l1", "s2-l1"]);
  });

  it("keeps an older passed image on the new requirement switched off", () => {
    const cleared = imageChecksFromAudit({ cleared: true });
    expect(cleared.find((check) => check.id === "emotionalTone")).toMatchObject({ state: "pass", enabled: false });
    expect(cleared.find((check) => check.id === "soundsSpoken")).toMatchObject({ state: "pass", enabled: false });
    const stored = ensureImageLegacySwitches([
      { id: "hookHolds", state: "pass" },
      { id: "messageStays", state: "pass" },
    ]);
    expect(stored.map((check) => check.id)).toEqual(["hookHolds", "soundsSpoken", "messageStays", "emotionalTone"]);
    expect(stored.find((check) => check.id === "emotionalTone")).toMatchObject({ state: "pass", enabled: false });
    expect(stored.find((check) => check.id === "soundsSpoken")).toMatchObject({ state: "pass", enabled: false });
  });

  it("keeps a person failure that names no slide, without repairing a slide", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("the person it happens to")) {
        return '{"pass":false,"reason":"Narasi hanya menjelaskan sistem.","lineIds":[]}';
      }
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const post = script();
    const result = await runImageMeaningChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: post,
      image: settings,
      masterSells: false,
      prior: imageChecksOn,
      ask,
      onStep: () => undefined,
    });
    expect(result.checks.find((check) => check.id === "emotionalTone")).toMatchObject({
      state: "fail",
      reason: "Narasi hanya menjelaskan sistem.",
      lineIds: [],
    });
    expect(result.facts.relationToParent).toBe("PERSON_MISSED");
    expect(imageSlideRepairReady(result.facts, post)).toBe(false);
    const lesson = lessonFromMeaningAudit(result.facts, post);
    expect(lesson).toEqual({
      checkId: "emotionalTone",
      reason: "Narasi hanya menjelaskan sistem.",
      lines: [],
    });
    const next = buildImageGeneratePrompt({
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      pillar: "Education - The 'Stop Doing This'",
      image: settings,
      enabled: ["emotionalTone"],
      lessons: lesson ? [lesson] : [],
    });
    expect(next).toContain("Why it failed: Narasi hanya menjelaskan sistem.");
  });

  it("stores the caption when a single image misses the person there", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("the person it happens to")) {
        return '{"pass":false,"reason":"Caption hanya menjelaskan cara kerjanya.","lineIds":["caption"]}';
      }
      return '{"pass":true,"reason":"","lineIds":[]}';
    });
    const image = { format: "single" as const, slideCountMode: "manual" as const, slideCount: null, withImage: true };
    const post = stampImageScript({ ...script(), scenes: [script().scenes[0]!] }, image);
    const result = await runImageMeaningChecks({
      pillar: "Education - The 'Stop Doing This'",
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      script: post,
      image,
      masterSells: false,
      prior: imageChecksOn,
      ask,
      onStep: () => undefined,
    });
    expect(result.checks.find((check) => check.id === "emotionalTone")).toMatchObject({
      state: "fail",
      reason: "Caption hanya menjelaskan cara kerjanya.",
      lineIds: ["caption"],
    });
    expect(imageSlideRepairReady(result.facts, post)).toBe(true);
    const lesson = lessonFromMeaningAudit(result.facts, post);
    expect(lesson).toEqual({
      checkId: "emotionalTone",
      reason: "Caption hanya menjelaskan cara kerjanya.",
      lines: ["✨ Satu hal.\n#Evaluasi"],
    });
    const next = buildImageGeneratePrompt({
      masterStatement: "Nilai strategis.",
      ideaStatement: "Tidak terukur.",
      pillar: "Education - The 'Stop Doing This'",
      image,
      enabled: ["emotionalTone"],
      lessons: lesson ? [lesson] : [],
    });
    expect(next).toContain("✨ Satu hal.");
    expect(next).toContain("Why it failed: Caption hanya menjelaskan cara kerjanya.");
  });
});
