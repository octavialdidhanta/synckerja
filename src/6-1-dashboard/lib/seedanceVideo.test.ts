import { describe, expect, it } from "vitest";
import {
  audioForbidden,
  buildVideoPrompt,
  durationChoices,
  durationIsValid,
  geminiAspectRatio,
  GEMINI_VIDEO_MODEL,
  imageRatioDiffers,
  lookIsUgc,
  masterGroupRows,
  missingConceptImages,
  readLook,
  ugcLookDetail,
  promptSlideForImage,
  activeShotBriefs,
  briefForStoredScene,
  masterPromptWithActiveShots,
  readShotBrief,
  shootHeaderLabels,
  shootNumberFromShotLabel,
  veoColumnUsesSlides,
  videoRatioForContent,
} from "@/6-1-dashboard/lib/seedanceVideo";

const headers = ["Timing", "Visual", "VO (Voice Over)", "Master prompt"];

describe("seedance video settings", () => {
  it("caps Seedance 2.0 at 15 seconds and 2.5 at 30", () => {
    expect(durationChoices("dreamina-seedance-2-0-260128")).toEqual([5, 10, 15]);
    expect(durationChoices("dreamina-seedance-2-5-260628")).toEqual([5, 10, 15, 20, 25, 30]);
    expect(durationIsValid("dreamina-seedance-2-0-260128", 20)).toBe(false);
    expect(durationIsValid("dreamina-seedance-2-5-260628", 7)).toBe(false);
    expect(durationIsValid("dreamina-seedance-2-5-260628", 30)).toBe(true);
    expect(durationChoices(GEMINI_VIDEO_MODEL)).toEqual([4, 6, 8, 10]);
    expect(durationIsValid(GEMINI_VIDEO_MODEL, 5)).toBe(false);
    expect(durationChoices("veo-3.1-generate-preview")).toEqual([4, 6, 8]);
    expect(durationChoices("veo-3.1-lite-generate-preview", "1080p")).toEqual([8]);
    expect(durationChoices("veo-3.0-generate-001")).toEqual([4, 6, 8]);
    expect(durationIsValid("veo-3.1-fast-generate-preview", 10)).toBe(false);
    expect(geminiAspectRatio("16:9")).toBe("16:9");
    expect(geminiAspectRatio("9:16")).toBe("9:16");
    expect(geminiAspectRatio("4:5")).toBe("9:16");
  });

  it("reads look and silence from the master prompt", () => {
    const master = "Audio : no sound, no music\nLook : UGC, handheld iPhone";
    expect(readLook(master)).toBe("UGC, handheld iPhone");
    expect(lookIsUgc(readLook(master))).toBe(true);
    expect(lookIsUgc("Cinematic")).toBe(false);
    expect(audioForbidden(master)).toBe(true);
    expect(audioForbidden("Look : UGC")).toBe(false);
  });

  it("blocks a mentioned concept image that has not been saved", () => {
    const text = "Wide shot of @location_food_stall_outside_pik and @character_reviewer";
    expect(missingConceptImages(text, {
      locations: [{ handle: "@location_food_stall_outside_pik", description: "Stall" }],
      characters: [{ handle: "@character_reviewer", description: "Reviewer", portraitPath: "org/brief/plan/character_reviewer-portrait.jpg" }],
      properties: [],
    })).toEqual(["@location_food_stall_outside_pik"]);
  });

  it("uses the content type ratio and warns when the still does not match", () => {
    expect(videoRatioForContent("Reel")).toBe("9:16");
    expect(videoRatioForContent("Story")).toBe("9:16");
    expect(videoRatioForContent("Post", "1:1")).toBe("1:1");
    expect(videoRatioForContent("YouTube")).toBe("16:9");
    expect(imageRatioDiffers(1080, 1920, "9:16")).toBe(false);
    expect(imageRatioDiffers(1920, 1080, "9:16")).toBe(true);
  });

  it("groups empty master-prompt rows into one clip and keeps the shot text", () => {
    const rows = [
      ["0:00", "", "Hello", "Look : UGC\nAudio : no sound"],
      ["0:05", "", "", ""],
    ];
    expect(masterGroupRows(rows, headers, 0)).toEqual([0, 1]);
    const ugcPrompt = buildVideoPrompt({
      scope: "master",
      rows,
      headers,
      rowIndexes: [0, 1],
      ugcType: "Product Demo",
    });
    expect(ugcPrompt).toContain(`LOOK (required camera and grade — follow every line): ${ugcLookDetail()}`);
    expect(ugcPrompt).toContain("UGC look components:");
    expect(ugcPrompt).toContain("- UGC style handheld phone footage shot on iPhone 17 Pro Max");
    expect(ugcPrompt).toContain("- super high contrast, punchy shadows, bright subject");
    expect(ugcPrompt).toContain("- advertisement lighting / hard practical light, not soft cinematic window light");
    expect(ugcPrompt).toContain("Forbidden: cinematic soft window light");
    expect(ugcPrompt).toContain("UGC type: Product Demo");
    const shotPrompt = buildVideoPrompt({
      scope: "shot",
      rows,
      headers,
      rowIndexes: [1],
    });
    expect(shotPrompt).toContain(ugcLookDetail());
    expect(shotPrompt).not.toContain("Master prompt:");
  });

  it("reads the shot, angle, visual function, and Veo 3 prompt from the photo row", () => {
    const briefHeaders = ["Shot", "Angle", "Visual function", "Veo 3 prompt"];
    const brief = readShotBrief(briefHeaders, [
      "Shot 1 — Main Shot",
      "Medium shot",
      "Introduce the reviewer and their perspective.",
      "The reviewer looks up from a phone in a bright kitchen.",
    ]);
    expect(brief).toEqual({
      shot: "Shot 1 — Main Shot",
      angle: "Medium shot",
      visualFunction: "Introduce the reviewer and their perspective.",
      veoPrompt: "The reviewer looks up from a phone in a bright kitchen.",
    });
    expect(buildVideoPrompt({
      scope: "shot",
      rows: [briefHeaders.map(() => ""), [
        "Shot 1 — Main Shot",
        "Medium shot",
        "Introduce the reviewer and their perspective.",
        "The reviewer looks up from a phone in a bright kitchen.",
      ]],
      headers: briefHeaders,
      rowIndexes: [1],
    })).toContain("Veo 3 prompt: The reviewer looks up from a phone in a bright kitchen.");
  });

  it("takes the card shoot number from the Shot cell and keeps the position when that cell has no number", () => {
    expect(shootNumberFromShotLabel("Shot 1 — Main Shot", 4)).toBe(1);
    expect(shootNumberFromShotLabel("Shot 3 — Supporting Shot", 1)).toBe(3);
    expect(shootNumberFromShotLabel("Supporting Shot", 4)).toBe(4);
    expect(shootNumberFromShotLabel("", 2)).toBe(2);
  });

  it("marks a repeated shoot number inside one scene as 1.1 and 2.1", () => {
    expect(shootHeaderLabels([1, 2, 3, 1, 2])).toEqual(["1", "2", "3", "1.1", "2.1"]);
    expect(shootHeaderLabels([1, 1, 1])).toEqual(["1", "1.1", "1.2"]);
    expect(shootHeaderLabels([3, 1, 2])).toEqual(["3", "1", "2"]);
  });

  it("keeps an edited image prompt on that shot without rewriting the master prompt", () => {
    const briefHeaders = ["Shot", "Angle", "Visual function", "Veo 3 prompt", "Master prompt"];
    const rows = [[
      "Shot 1 — Main Shot",
      "Medium shot",
      "Introduce the reviewer.",
      "Medium shot of the reviewer at the table.",
      "Look : UGC\nAudio : no sound\nThe reviewer sits in the kitchen.",
    ]];
    const prompt = buildVideoPrompt({
      scope: "master",
      rows,
      headers: briefHeaders,
      rowIndexes: [0],
      veoByRow: { 0: "Close up of the reviewer by the window." },
    });
    expect(prompt).toContain("Veo 3 prompt: Close up of the reviewer by the window.");
    expect(prompt).toContain("Master prompt:\nLook : UGC");
    expect(prompt).not.toContain("Medium shot of the reviewer at the table.");
    expect(promptSlideForImage("Close up of the reviewer by the window.", "Medium shot of the reviewer at the table.")).toEqual({
      text: "Close up of the reviewer by the window.",
      locked: true,
    });
    expect(promptSlideForImage(null, "Medium shot of the reviewer at the table.").locked).toBe(false);
    expect(veoColumnUsesSlides([{ prompt_override: null }])).toBe(false);
    expect(veoColumnUsesSlides([{ prompt_override: "Close up" }])).toBe(true);
    expect(veoColumnUsesSlides([{ prompt_override: null }, { prompt_override: null }])).toBe(true);
  });

  it("keeps Master Prompt mentions off a single-shot generate", () => {
    const headers = ["Shot", "Angle", "Visual function", "Veo 3 prompt", "Master prompt"];
    const master = [
      "Audio : no sound",
      "Look : UGC",
      "",
      "Shot : Shot 1 — Main Shot",
      "Angle : Medium Shot",
      "Visual function : Establishing POV",
      "",
      "looking at @character_aunt and @character_wife at @location_newlywed_home",
      "",
      "Shot : Shot 2 — Supporting Shot",
      "Angle : Graphic Overlay",
      "Visual function : Identify Speaker",
      "",
      "Text overlay appears.",
    ].join("\n");
    const scene = {
      shot: "Shot 1 — Main Shot",
      angle: "Wide Shot",
      visualFunction: "Context",
      veoPrompt: "Aunt enters and warmly hugs Wife and husband at home.",
    };
    const prompt = buildVideoPrompt({
      scope: "shot",
      rows: [[scene.shot, scene.angle, scene.visualFunction, scene.veoPrompt, master]],
      headers,
      rowIndexes: [0],
      sceneByRow: { 0: scene },
    });
    expect(prompt).toContain("Aunt enters and warmly hugs Wife and husband at home.");
    expect(prompt).toContain(ugcLookDetail());
    expect(prompt).not.toContain("Master prompt:");
    expect(prompt).not.toContain("@character_aunt");
    expect(prompt).not.toContain("@location_newlywed_home");
    expect(prompt).not.toContain("Text overlay appears.");
    expect(missingConceptImages(prompt, null)).toEqual([]);
  });

  it("writes an opening and ending frame for one shot without rewriting the master prompt", () => {
    const briefHeaders = ["Shot", "Angle", "Visual function", "Veo 3 prompt", "VO (Voice Over)", "Master prompt"];
    const rows = [[
      "Shot 1 — Main Shot",
      "Medium shot",
      "Introduce the reviewer and their perspective.",
      "Medium shot of the reviewer at the table.",
      "Tahukah Anda",
      "Look : UGC\nThe reviewer sits in the kitchen.",
    ]];
    const prompt = buildVideoPrompt({
      scope: "shot",
      rows,
      headers: briefHeaders,
      rowIndexes: [0],
      veoByRow: { 0: "Medium shot of @character_reviewer looking thoughtful." },
      endVeo: "Medium shot of @character_reviewer doing a selfie.",
    });
    expect(prompt).toContain(ugcLookDetail());
    expect(prompt).not.toContain("Master prompt:");
    expect(prompt).not.toContain("The reviewer sits in the kitchen.");
    expect(prompt).toContain("Opening frame:\nShot: Shot 1 — Main Shot");
    expect(prompt).toContain("Veo 3 prompt: Medium shot of @character_reviewer looking thoughtful.");
    expect(prompt).toContain("Voice: Tahukah Anda");
    const ending = prompt.split("Ending frame:")[1] ?? "";
    expect(ending).toContain("Angle: Medium shot");
    expect(ending).toContain("Visual function: Introduce the reviewer and their perspective.");
    expect(ending).toContain("Veo 3 prompt: Medium shot of @character_reviewer doing a selfie.");
    expect(ending).not.toContain("Shot:");
    expect(ending).not.toContain("Voice:");
    expect(prompt).not.toContain("Medium shot of the reviewer at the table.");
  });

  it("follows the selected image shot, angle, and visual function in a master prompt", () => {
    const briefHeaders = ["Shot", "Angle", "Visual function", "Veo 3 prompt", "Master prompt"];
    const cell = {
      shot: "Shot 1 — Main Shot",
      angle: "Medium shot",
      visualFunction: "Introduce the reviewer.",
      veoPrompt: "Medium shot of the reviewer at the table.",
    };
    const selected = briefForStoredScene(cell, {
      shotText: "Shot 4 — Main Shot",
      angleText: "Over-the-shoulder shot - Wide Shot",
      visualFunctionText: "Show the reviewer looking the youtube or screen.",
      promptOverride: null,
    });
    expect(selected).toEqual({
      shot: "Shot 4 — Main Shot",
      angle: "Over-the-shoulder shot - Wide Shot",
      visualFunction: "Show the reviewer looking the youtube or screen.",
      veoPrompt: "Medium shot of the reviewer at the table.",
    });
    expect(briefForStoredScene(cell, {
      shotText: null,
      angleText: "  ",
      visualFunctionText: null,
      promptOverride: "Tablet screen inside the complex.",
    })).toEqual({
      ...cell,
      veoPrompt: "Tablet screen inside the complex.",
    });
    const rows = [[
      cell.shot,
      cell.angle,
      cell.visualFunction,
      cell.veoPrompt,
      "Look : UGC\nThe reviewer sits in the kitchen.",
    ]];
    const prompt = buildVideoPrompt({
      scope: "master",
      rows,
      headers: briefHeaders,
      rowIndexes: [0],
      sceneByRow: { 0: selected },
    });
    expect(prompt).toContain("Shot: Shot 4 — Main Shot");
    expect(prompt).toContain("Angle: Over-the-shoulder shot - Wide Shot");
    expect(prompt).toContain("Visual function: Show the reviewer looking the youtube or screen.");
    expect(prompt).toContain("Veo 3 prompt: Medium shot of the reviewer at the table.");
    expect(prompt).toContain("Master prompt:\nLook : UGC");
    expect(prompt).not.toContain("Shot: Shot 1 — Main Shot");
    expect(prompt).not.toContain("Angle: Medium shot");
  });

  it("writes the open shot version into each master-prompt block and leaves audio and look alone", () => {
    const master = [
      "Audio : no sound, no music",
      "Look : UGC, handheld iPhone",
      "",
      "Shot : Shot 1 — Main Shot",
      "Angle : Over-the-shoulder shot",
      "Visual function : Show the map.",
      "",
      "Over-the-shoulder shot of the map.",
      "",
      "Shot : Shot 2 — Supporting Shot",
      "Angle : Insert shot",
      "Visual function : Highlight the inside.",
      "",
      "Insert shot of the tablet screen.",
    ].join("\n");
    const briefs = activeShotBriefs(
      ["Shot", "Angle", "Visual function", "Veo 3 prompt"],
      [
        ["Shot 1 — Main Shot", "Over-the-shoulder shot", "Show the map.", "Over-the-shoulder shot of the map."],
        ["Shot 2 — Supporting Shot", "Insert shot", "Highlight the inside.", "Insert shot of the tablet screen."],
      ],
      {
        0: [
          { id: "original", shot_text: "Shot 1 — Main Shot", angle_text: "Over-the-shoulder shot", visual_function_text: "Show the map.", prompt_override: "Over-the-shoulder shot of the map." },
          { id: "active", shot_text: "Shot 4 — Main Shot", angle_text: "Over-the-shoulder shot - Wide Shot", visual_function_text: "Show the reviewer looking the youtube or screen.", prompt_override: "Over-the-shoulder shot of the youtube screen." },
        ],
      },
      { 0: "active" },
      [0, 1],
    );
    const shown = masterPromptWithActiveShots(master, briefs);
    expect(shown.startsWith("Audio : no sound, no music\nLook : UGC, handheld iPhone\n\n")).toBe(true);
    expect(shown).toContain("Shot : Shot 4 — Main Shot\nAngle : Over-the-shoulder shot - Wide Shot\nVisual function : Show the reviewer looking the youtube or screen.\n\nOver-the-shoulder shot of the youtube screen.");
    expect(shown).toContain("Shot : Shot 2 — Supporting Shot\nAngle : Insert shot\nVisual function : Highlight the inside.\n\nInsert shot of the tablet screen.");
    expect(shown).not.toContain("Show the map.");
    const prompt = buildVideoPrompt({
      scope: "master",
      rows: [[
        "Shot 1 — Main Shot",
        "Over-the-shoulder shot",
        "Show the map.",
        "Over-the-shoulder shot of the map.",
        master,
      ]],
      headers: ["Shot", "Angle", "Visual function", "Veo 3 prompt", "Master prompt"],
      rowIndexes: [0],
      sceneByRow: { 0: briefs[0] },
    });
    expect(prompt).toContain("Master prompt:\nAudio : no sound, no music");
    expect(prompt).toContain("Shot : Shot 4 — Main Shot");
    expect(prompt).not.toContain("Shot : Shot 1 — Main Shot");
  });
});
