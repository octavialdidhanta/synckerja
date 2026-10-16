import { describe, expect, it } from "vitest";
import { parseBriefSequencesFromMarkdown } from "@/6-1-dashboard/modal/briefSequences";
import { parseBriefConcept } from "@/6-1-dashboard/modal/briefConceptAssets";
import { parseAIScriptOutput } from "@/6-1-script-generator/utils/parseAIScriptOutput";
import { groupContentPillars } from "@/thinking-lab/execution/pillars";
import {
  buildLineRepairPrompt,
  buildPlanBriefMarkdown,
  buildPlanScript,
  flattenVoiceOver,
  mergeRepairedLines,
  narrationDurationSeconds,
  parseLineIssues,
  parseLineReplacements,
  parseMasterSells,
  parseVoiceOverScript,
  pillarLessSuitable,
  withCharacterVisuals,
  withoutCharacterVisual,
  scriptDurationSeconds,
  scriptLineRepairReady,
  type VoiceOverScript,
} from "@/thinking-lab/execution/script";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

const sample = {
  assets: {
    locations: [{ handle: "ruang reuni", description: "A casual room" }],
    characters: [{ handle: "@character_teman", description: "A friend" }],
    properties: [],
  },
  scenes: [
    {
      title: "SCENE 1 — HOOK",
      lines: [
        {
          narration: "Lo bilang, nabung doang nggak seru.",
          shots: [{ role: "Shot 1 — Main Shot", angle: "wide, static", visualFunction: "keberatan tampil", prompt: "text card" }],
        },
        { narration: "Sekarang dengerin obrolan mereka.", shots: [] },
      ],
    },
  ],
};

function facts(overrides: Partial<ExecutionSemanticFacts> = {}): ExecutionSemanticFacts {
  return {
    pillar: "Handling Objections",
    whatItSays: "A scene",
    relationToParent: "MESSAGE_ADDED",
    messageAdded: true,
    mechanismVisible: true,
    pillarOutside: false,
    masterSells: false,
    viewerClimb: "CLIMBS",
    subjectMatch: "MATCH",
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("voice-over script", () => {
  it("parses scenes, assigns ids, and flattens the narration", () => {
    const script = parseVoiceOverScript(sample);
    expect(script?.scenes).toHaveLength(1);
    expect(script?.scenes[0]?.lines[0]?.id).toBe("s1-l1");
    expect(script?.assets.locations[0]?.handle).toBe("@ruang_reuni");
    expect(flattenVoiceOver(script as VoiceOverScript)).toContain("Lo bilang, nabung doang nggak seru.");
    expect(flattenVoiceOver(script as VoiceOverScript)).toContain("SCENE 1 — HOOK");
    expect(script?.title).toBe("");
    expect(script?.caption).toBe("");
    const packed = parseVoiceOverScript({ ...sample, title: "Uang yang diam", caption: "Budi menunda, dan waktunya jalan." });
    expect(packed?.title).toBe("Uang yang diam");
    expect(packed?.caption).toBe("Budi menunda, dan waktunya jalan.");
    expect(flattenVoiceOver(packed as VoiceOverScript)).not.toContain("Uang yang diam");
  });

  it("writes one storyboard table and one sequence per scene", () => {
    const script = parseVoiceOverScript({
      ...sample,
      scenes: [
        {
          title: "SCENE 1 — HOOK",
          lines: [
            {
              narration: "Lo bilang, nabung.",
              shots: [
                { role: "Shot 1 — Main Shot", angle: "Wide", visualFunction: "buka", prompt: "wide room" },
                { role: "Shot 2 — Supporting Shot", angle: "Close-up", visualFunction: "detail", prompt: "hands" },
              ],
            },
          ],
        },
        {
          title: "SCENE 2 — TURN",
          lines: [
            {
              narration: "Sekarang dia hitung.",
              shots: [{ role: "Shot 1 — Main Shot", angle: "Medium", visualFunction: "hitung", prompt: "calculator" }],
            },
          ],
        },
      ],
    }) as VoiceOverScript;
    const brief = buildPlanBriefMarkdown(script);
    expect(brief).toContain("| Timing | Visual | VO (Voice Over) | Shot | Angle | Visual function | Veo 3 prompt |");
    expect(brief).toContain("|  |  | Lo bilang, nabung. | Shot 1 — Main Shot | Wide | buka | wide room |");
    expect(brief).toContain("|  |  |  | Shot 2 — Supporting Shot | Close-up | detail | hands |");
    expect(brief).toContain("|  |  | Sekarang dia hitung. | Shot 1 — Main Shot | Medium | hitung | calculator |");
    expect(brief).not.toContain("<!-- thinking-lab-vo -->");
    expect(brief).not.toContain("## SCENE 1 — HOOK");
    expect(brief).not.toContain("Element Lainnya");
    const sequences = parseBriefSequencesFromMarkdown(brief);
    expect(sequences?.map((sequence) => sequence.name)).toEqual(["SCENE 1 — HOOK", "SCENE 2 — TURN"]);
    expect(sequences?.map((sequence) => sequence.rowCount)).toEqual([2, 1]);
  });

  it("puts location, character, and property into the plan concept without the storyboard", () => {
    const org = "11111111-1111-4111-8111-111111111111";
    const execution = "22222222-2222-4222-8222-222222222222";
    const script = parseVoiceOverScript({
      ...sample,
      caption: "Caption plan",
      assets: {
        locations: [{ handle: "ruang reuni", description: "A casual room" }],
        characters: [{
          handle: "@character_teman",
          description: "A friend",
          portraitPath: `${org}/thinking-lab/${execution}/character_teman-portrait.jpg`,
          bodyPath: `${org}/thinking-lab/${execution}/character_teman-body.png`,
        }],
        properties: [{ handle: "@property_gelas", description: "A glass" }],
      },
    }) as VoiceOverScript;
    const parsed = parseAIScriptOutput(buildPlanScript(script));
    expect(parsed.brief).toContain("| Timing | Visual |");
    expect(parsed.brief).not.toContain("portrait.jpg");
    expect(parsed.caption).toBe("Caption plan");
    const concept = parseBriefConcept(parsed.concept);
    expect(concept?.voiceOver).toBe(flattenVoiceOver(script));
    expect(concept?.locations[0]?.description).toBe("A casual room");
    expect(concept?.characters[0]?.portraitPath).toContain("portrait.jpg");
    expect(concept?.characters[0]?.bodyPath).toContain("body.png");
    expect(concept?.properties[0]?.description).toBe("A glass");
  });

  it("rejects a script that has no narration", () => {
    expect(parseVoiceOverScript({ scenes: [{ title: "Empty", lines: [{ shots: [] }] }] })).toBeNull();
    expect(parseVoiceOverScript({ scenes: [] })).toBeNull();
  });

  it("rounds narration length to the nearest five seconds", () => {
    expect(narrationDurationSeconds("satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas")).toBe(5);
    expect(scriptDurationSeconds(parseVoiceOverScript(sample) as VoiceOverScript)).toBe(5);
  });

  it("marks Flash Sale Hook only when the Master Thought is not selling", () => {
    expect(pillarLessSuitable("Flash Sale Hook", false)).toBe(true);
    expect(pillarLessSuitable("FLASH_SALE_HOOK", false)).toBe(true);
    expect(pillarLessSuitable("Flash Sale Hook", true)).toBe(false);
    expect(pillarLessSuitable("Flash Sale Hook", "unresolved")).toBe(false);
    expect(pillarLessSuitable("Handling Objections", false)).toBe(false);
    expect(parseMasterSells({ masterSells: false })).toBe(false);
  });

  it("merges only the repaired narration line and keeps the other shots", () => {
    const script = parseVoiceOverScript({
      ...sample,
      lineIssues: [{ lineId: "s1-l1", reason: "pesan Idea hilang" }],
    }) as VoiceOverScript;
    expect(scriptLineRepairReady(facts(), script)).toBe(true);
    expect(scriptLineRepairReady(facts({ viewerClimb: "OTHER", relationToParent: "CLIMB_MISSED" }), script)).toBe(false);
    const merged = mergeRepairedLines(script, parseLineReplacements({
      lines: [{ lineId: "s1-l1", narration: "Nabungnya keliatan dari obrolan itu.", shots: [{ role: "Shot 1 — Main Shot", angle: "close", visualFunction: "uang", prompt: "coins" }] }],
    }));
    expect(merged.lineIssues).toEqual([]);
    expect(merged.scenes[0]?.lines[0]?.narration).toBe("Nabungnya keliatan dari obrolan itu.");
    expect(merged.scenes[0]?.lines[0]?.shots[0]?.prompt).toBe("coins");
    expect(merged.scenes[0]?.lines[1]?.narration).toBe("Sekarang dengerin obrolan mereka.");
    expect(parseLineIssues({ lines: [{ lineId: "s1-l2", reason: "masih meleset" }, { lineId: "missing", reason: "no" }] }, script)).toEqual([
      { lineId: "s1-l2", reason: "masih meleset" },
    ]);
  });

  it("asks the repair to return only the failing lines", () => {
    const script = parseVoiceOverScript(sample) as VoiceOverScript;
    const prompt = buildLineRepairPrompt({
      ideaStatement: "Reuni geng motor membuka obrolan uang sekolah.",
      pillarName: "Handling Objections",
      script: { ...script, lineIssues: [{ lineId: "s1-l1", reason: "pesan Idea" }] },
    });
    expect(prompt).toContain("only the narration lines that failed");
    expect(prompt).toContain("more than one shot");
    expect(prompt).toContain("s1-l1");
    expect(prompt).not.toContain("industry");
  });

  it("keeps a character portrait and sheet path on the script", () => {
    const org = "11111111-1111-4111-8111-111111111111";
    const execution = "22222222-2222-4222-8222-222222222222";
    const portraitPath = `${org}/thinking-lab/${execution}/character_teman-portrait.jpg`;
    const sheetPath = `${org}/thinking-lab/${execution}/character_teman-sheet.png`;
    const script = parseVoiceOverScript({
      ...sample,
      assets: {
        ...sample.assets,
        characters: [{ handle: "@character_teman", description: "A friend", portraitPath, sheetPath, extra: "no" }],
      },
    }) as VoiceOverScript;
    expect(script.assets.characters[0]).toEqual({ handle: "@character_teman", description: "A friend", portraitPath, sheetPath });
    const updated = withCharacterVisuals(script, "@character_teman", { portraitPath, sheetPath: `${org}/thinking-lab/${execution}/character_teman-sheet.jpg` });
    expect(updated.assets.characters[0]?.sheetPath).toContain("sheet.jpg");
    expect(updated.assets.characters[0]?.visualRevision).toBeGreaterThan(0);
    expect(updated.scenes).toBe(script.scenes);
    const bodyPath = `${org}/thinking-lab/${execution}/character_teman-body.jpg`;
    const withBody = withCharacterVisuals(updated, "@character_teman", { bodyPath });
    expect(withBody.assets.characters[0]?.bodyPath).toBe(bodyPath);
    expect(withBody.assets.characters[0]?.portraitPath).toContain("portrait.jpg");
    const sheetOnly = withoutCharacterVisual(withBody, "@character_teman", "portrait");
    expect(sheetOnly.assets.characters[0]?.portraitPath).toBeUndefined();
    expect(sheetOnly.assets.characters[0]?.sheetPath).toContain("sheet.jpg");
    expect(sheetOnly.assets.characters[0]?.bodyPath).toBe(bodyPath);
    const noBody = withoutCharacterVisual(sheetOnly, "@character_teman", "body");
    expect(noBody.assets.characters[0]?.bodyPath).toBeUndefined();
    const cleared = withoutCharacterVisual(noBody, "@character_teman", "sheet");
    expect(cleared.assets.characters[0]).toEqual({ handle: "@character_teman", description: "A friend" });
    const rejected = parseVoiceOverScript({
      ...sample,
      assets: {
        ...sample.assets,
        characters: [{ handle: "@character_teman", description: "A friend", portraitPath: "https://evil.example/a.jpg", sheetPath: "../secret.png" }],
      },
    }) as VoiceOverScript;
    expect(rejected.assets.characters[0]?.portraitPath).toBeUndefined();
    expect(rejected.assets.characters[0]?.sheetPath).toBeUndefined();
    const parsedBody = parseVoiceOverScript({
      ...sample,
      assets: { ...sample.assets, characters: [{ handle: "@character_teman", description: "A friend", bodyPath }] },
    }) as VoiceOverScript;
    expect(parsedBody.assets.characters[0]?.bodyPath).toBe(bodyPath);
  });

  it("groups organization pillars by funnel and keeps every stage that has rows", () => {
    const groups = groupContentPillars([
      { id: "1", name: "Handling Objections", funnel: "bottom", category: null, isDefault: true },
      { id: "2", name: "B-Roll Storytelling", funnel: "top", category: "Story", isDefault: true },
    ]);
    expect(groups.map((group) => group.funnel)).toEqual(["top", "bottom"]);
  });
});
