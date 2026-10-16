import { describe, expect, it } from "vitest";
import { parseBriefSequencesFromMarkdown } from "@/6-1-dashboard/modal/briefSequences";
import { parseMarkdownTable } from "@/6-1-dashboard/utils/markdownTableUtils";
import { parseBriefConcept } from "@/6-1-dashboard/modal/briefConceptAssets";
import { parseAIScriptOutput } from "@/6-1-script-generator/utils/parseAIScriptOutput";
import { groupContentPillars } from "@/thinking-lab/execution/pillars";
import {
  audioMasterLine,
  buildLineAuditPrompt,
  buildLineRepairPrompt,
  buildSpeechRepairPrompt,
  lookMasterLine,
  mergeSpeechRepairs,
  parseSpeechRepairs,
  speechNeedsRepair,
  buildPlanBriefMarkdown,
  buildPlanScript,
  flattenVoiceOver,
  lineAudio,
  lineMasterPrompt,
  mergeRepairedLines,
  durationWordBudget,
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
    expect(script?.audio).toEqual({ sound: false, music: false });
    expect(parseVoiceOverScript({ ...sample, audio: { sound: true, music: false } })?.audio).toEqual({
      sound: true,
      music: false,
    });
    expect(script?.look).toBeUndefined();
    expect(parseVoiceOverScript({ ...sample, look: "ugc" })?.look).toBe("ugc");
    expect(parseVoiceOverScript({ ...sample, look: "movie" })?.look).toBeUndefined();
    expect(script?.speech).toBeUndefined();
    expect(parseVoiceOverScript({ ...sample, speech: "vo" })?.speech).toBe("vo");
    expect(parseVoiceOverScript({ ...sample, speech: "vo" })?.scenes[0]?.lines[0]?.delivery).toBe("vo");
    expect(parseVoiceOverScript({ ...sample, speech: "talk" })?.speech).toBeUndefined();
    const mixed = parseVoiceOverScript({
      ...sample,
      speech: "mix",
      scenes: [
        {
          title: "SCENE 1 — HOOK",
          lines: [
            { narration: "Narasi.", delivery: "vo", shots: [{ role: "Shot 1", angle: "wide", visualFunction: "buka", prompt: "room" }] },
            { narration: "Ucapan.", delivery: "dialogue", shots: [{ role: "Shot 1", angle: "close", visualFunction: "bicara", prompt: "face" }] },
          ],
        },
      ],
    });
    expect(mixed?.scenes[0]?.lines[0]?.delivery).toBe("vo");
    expect(mixed?.scenes[0]?.lines[1]?.delivery).toBe("dialogue");
    expect(parseVoiceOverScript({ ...sample, speech: "dialog" })?.scenes[0]?.lines[0]?.delivery).toBe("dialogue");
    expect(parseVoiceOverScript({ ...sample, speech: "silent" })?.scenes[0]?.lines[0]?.delivery).toBe("silent");
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
    expect(brief).toContain("| Timing | Visual | VO (Voice Over) | Shot | Angle | Visual function | Veo 3 prompt | Master prompt |");
    const table = parseMarkdownTable(brief)?.table ?? [];
    expect(table[1]?.at(-1)).toBe(lineMasterPrompt(script.scenes[0].lines[0]));
    expect(table[2]?.at(-1)).toBe("");
    expect(table[3]?.at(-1)).toBe(lineMasterPrompt(script.scenes[1].lines[0]));
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

  it("builds a master prompt from only that sentence's shots", () => {
    const script = parseVoiceOverScript({
      title: "Warisan kecil",
      caption: "Budi baru mulai.",
      assets: {
        locations: [{ handle: "@location_apartment_living_room", description: "A small apartment living room" }],
        characters: [{ handle: "@character_budi_young", description: "Budi at age 20" }],
        properties: [
          { handle: "@property_bank_statement", description: "A bank statement" },
          { handle: "@property_laptop", description: "A laptop" },
        ],
      },
      scenes: [
        {
          title: "SCENE 1 — HOOK",
          lines: [
            {
              narration: "Budi dapat warisan kecil di usia 20, niatnya mau investasi.",
              shots: [
                {
                  role: "Shot 1 — Main Shot",
                  angle: "Medium shot",
                  visualFunction: "Introduce young Budi and his initial situation.",
                  prompt: "Medium shot of @character_budi_young looking at a @property_bank_statement with a thoughtful expression in @location_apartment_living_room.",
                },
                {
                  role: "Shot 2 — Supporting Shot",
                  angle: "Close-up",
                  visualFunction: "Show the complexity he perceives.",
                  prompt: "Close-up of a @property_laptop screen displaying complex investment charts and graphs.",
                },
              ],
            },
            {
              narration: "Kalimat lain.",
              shots: [{ role: "Shot 1 — Main Shot", angle: "Wide", visualFunction: "Lain", prompt: "Wide room" }],
            },
          ],
        },
      ],
    }) as VoiceOverScript;
    const line = script.scenes[0]?.lines[0] as VoiceOverScript["scenes"][0]["lines"][0];
    const prompt = lineMasterPrompt(line);
    expect(prompt.startsWith("Audio : no sound, no music\n\nShot : Shot 1 — Main Shot\nAngle : Medium shot\nVisual function : Introduce young Budi and his initial situation.")).toBe(true);
    expect(prompt).not.toContain("Title:");
    expect(prompt).not.toContain("Caption:");
    expect(prompt).not.toContain("Scene:");
    expect(prompt).not.toContain("Narration:");
    expect(prompt).not.toContain("Characters:");
    expect(prompt).not.toContain("Locations:");
    expect(prompt).not.toContain("Properties:");
    expect(prompt).toContain("Shot : Shot 2 — Supporting Shot\nAngle : Close-up\nVisual function : Show the complexity he perceives.");
    expect(prompt).toContain("Close-up of a @property_laptop screen displaying complex investment charts and graphs.");
    expect(prompt).not.toContain("Kalimat lain.");
    expect(prompt).not.toContain("Look :");
    expect(prompt).not.toContain("Speech :");
    expect(prompt).not.toContain("Delivery :");
    expect(prompt).not.toContain("Wide room");
    expect(lookMasterLine("ugc")).toBe("Look : UGC, handheld iPhone, natural light, no bokeh, no cinematic grade");
    expect(lookMasterLine("commercial")).toBe(
      "Look : commercial ad, stable camera, clean even lighting, sharp product focus, polished but not a movie",
    );
    expect(lookMasterLine("cinematic")).toBe(
      "Look : cinematic film, motivated lighting, shallow depth of field, camera on tripod or dolly, filmic color",
    );
    expect(lineMasterPrompt(line, { sound: false, music: false }, "ugc")).toBe(
      `Audio : no sound, no music\n${lookMasterLine("ugc")}\n\n${prompt.slice("Audio : no sound, no music\n\n".length)}`,
    );
    const mixed = lineMasterPrompt({ ...line, delivery: "dialogue" }, { sound: false, music: false });
    expect(mixed.startsWith("Audio : no sound, no music\n\nShot : Shot 1 — Main Shot")).toBe(true);
    expect(mixed).not.toContain("Speech :");
    expect(mixed).not.toContain("Delivery :");
    expect(audioMasterLine({ sound: true, music: false })).toBe("Audio : sound, no music");
    expect(audioMasterLine({ sound: false, music: true })).toBe("Audio : music, no sound");
    expect(audioMasterLine({ sound: true, music: true })).toBe("Audio : sound and music");
    expect(audioMasterLine({ sound: false, music: false })).toBe("Audio : no sound, no music");
    expect(lineMasterPrompt(line, { sound: true, music: true }).startsWith("Audio : sound and music\n\nShot : Shot 1 — Main Shot")).toBe(true);
  });

  it("rejects a script that has no narration", () => {
    expect(parseVoiceOverScript({ scenes: [{ title: "Empty", lines: [{ shots: [] }] }] })).toBeNull();
    expect(parseVoiceOverScript({ scenes: [] })).toBeNull();
  });

  it("rounds narration length to the nearest five seconds", () => {
    expect(narrationDurationSeconds("satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas")).toBe(5);
    expect(durationWordBudget(30)).toBe(66);
    expect(parseVoiceOverScript({ ...sample, durationSeconds: 45 })?.durationSeconds).toBe(45);
    expect(parseVoiceOverScript({ ...sample, durationSeconds: 0 })?.durationSeconds).toBeUndefined();
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
    expect(scriptLineRepairReady(facts(), { ...script, lineIssues: [] })).toBe(false);
    expect(scriptLineRepairReady(facts({ viewerClimb: "OTHER", relationToParent: "CLIMB_MISSED" }), script)).toBe(true);
    expect(scriptLineRepairReady(facts({ mechanismVisible: false, relationToParent: "MECHANISM_HIDDEN" }), script)).toBe(false);
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

  it("repairs a mix script once when dialogue has no said line", () => {
    const script = parseVoiceOverScript({
      speech: "mix",
      scenes: [
        {
          title: "SCENE 1",
          lines: [
            { narration: "Narasi.", delivery: "vo", shots: [{ role: "Shot 1", angle: "wide", visualFunction: "lihat", prompt: "A quiet room." }] },
            { narration: "Ucapan.", delivery: "dialogue", shots: [{ role: "Shot 1", angle: "close", visualFunction: "bicara", prompt: "A face." }] },
          ],
        },
      ],
    }) as VoiceOverScript;
    expect(speechNeedsRepair(script, "mix")).toBe(true);
    expect(speechNeedsRepair(script, "vo")).toBe(false);
    expect(speechNeedsRepair({ ...script, speech: "silent" }, "silent")).toBe(true);
    const merged = mergeSpeechRepairs(
      script,
      parseSpeechRepairs({
        lines: [
          {
            lineId: "s1-l2",
            narration: "Ucapan.",
            delivery: "dialogue",
            shots: [
              { role: "Shot 1", angle: "close", visualFunction: "bicara", prompt: '@Budi_muda said: "Ucapan."' },
              { role: "Shot 2", angle: "wide", visualFunction: "ruang", prompt: "A quiet room." },
              { role: "Shot 3", angle: "insert", visualFunction: "tangan", prompt: "Hands on the table." },
            ],
          },
          { lineId: "missing", narration: "Tidak", delivery: "dialogue", shots: [] },
        ],
      }),
    );
    expect(merged.scenes[0]?.lines[0]?.shots[0]?.prompt).toBe("A quiet room.");
    expect(merged.scenes[0]?.lines[1]?.shots[0]?.prompt).toBe('@Budi_muda said: "Ucapan."');
    expect(speechNeedsRepair(merged, "mix")).toBe(false);
    expect(lineMasterPrompt(merged.scenes[0]?.lines[1] as VoiceOverScript["scenes"][0]["lines"][0])).toContain('said:');
    expect(lineMasterPrompt(merged.scenes[0]?.lines[1] as VoiceOverScript["scenes"][0]["lines"][0])).not.toContain("Speech :");
    const repeated = lineMasterPrompt({
      id: "s1-l1",
      narration: "Ucapan.",
      delivery: "dialogue",
      shots: [
        { id: "a", role: "Shot 1 — Main Shot", angle: "wide", visualFunction: "bicara", prompt: 'Wide shot. @Budi_muda said: "Ucapan."' },
        { id: "b", role: "Shot 2 — Supporting Shot", angle: "close", visualFunction: "wajah", prompt: 'Close-up of the face. @Budi_muda said: "Ucapan."' },
      ],
    });
    expect(repeated.match(/said:/gi)?.length).toBe(1);
    expect(repeated).toContain("Close-up of the face.");
    const dialog = parseVoiceOverScript({
      speech: "dialog",
      scenes: [
        {
          title: "SCENE 1",
          lines: [{ narration: "Halo.", delivery: "dialogue", shots: [{ role: "Shot 1", angle: "medium", visualFunction: "bicara", prompt: "A person." }] }],
        },
      ],
    }) as VoiceOverScript;
    expect(speechNeedsRepair(dialog, "dialog")).toBe(true);
    const repair = buildSpeechRepairPrompt({
      ideaStatement: "Budi menunda investasi.",
      pillarName: "B-Roll Storytelling",
      speech: "dialog",
      script: dialog,
    });
    expect(repair).toContain('said: "the narration sentence, unchanged"');
    expect(repair).toContain("at least three shots");
    expect(repair).toContain("also names a @location token");
    const dialogueLine = {
      id: "s1-l1",
      narration: "Ucapan.",
      delivery: "dialogue" as const,
      shots: [
        { id: "a", role: "Shot 1", angle: "close", visualFunction: "bicara", prompt: '@Budi_muda said: "Ucapan."' },
        { id: "b", role: "Shot 2", angle: "wide", visualFunction: "ruang", prompt: "A room." },
      ],
    };
    const voiceLine = {
      id: "s1-l2",
      narration: "Narasi.",
      delivery: "vo" as const,
      shots: [{ id: "c", role: "Shot 1", angle: "wide", visualFunction: "lihat", prompt: "A street." }],
    };
    const mixAudio = { audio: { sound: false, music: true }, speech: "mix" as const };
    expect(lineAudio(mixAudio, dialogueLine)).toEqual({ sound: true, music: true });
    expect(lineAudio(mixAudio, voiceLine)).toEqual({ sound: false, music: true });
    expect(lineMasterPrompt(dialogueLine, lineAudio({ audio: { sound: false, music: false }, speech: "mix" }, dialogueLine))).toContain(
      "Audio : sound, no music",
    );
    expect(lineMasterPrompt(dialogueLine, lineAudio({ audio: { sound: false, music: false }, speech: "mix" }, dialogueLine))).not.toContain(
      "no sound",
    );
    expect(
      speechNeedsRepair(
        {
          ...dialog,
          scenes: [{ ...dialog.scenes[0], lines: [dialogueLine] }],
        },
        "dialog",
      ),
    ).toBe(true);
  });

  it("requires a location in any shot that names a character", () => {
    const placed = (prompt: string) =>
      parseVoiceOverScript({
        speech: "vo",
        scenes: [{ title: "SCENE 1", lines: [{ narration: "Narasi.", delivery: "vo", shots: [{ role: "Shot 1", angle: "close", visualFunction: "lihat", prompt }] }] }],
      }) as VoiceOverScript;
    const hands = placed("Close-up on @character_budi's hands holding @property_old_photo.");
    expect(speechNeedsRepair(hands, "vo")).toBe(true);
    expect(speechNeedsRepair(placed("Close-up on @character_budi's hands holding @property_old_photo in @location_home_office."), "vo")).toBe(false);
    expect(speechNeedsRepair(placed("Extreme close-up on the cover of @property_bank_book."), "vo")).toBe(false);
    const long = "Budi sits at the desk and turns the old photograph over while the bank book stays closed beside his hand so the viewer can see the choice he keeps delaying.";
    const dialog = parseVoiceOverScript({
      speech: "dialog",
      scenes: [
        {
          title: "SCENE 1",
          lines: [
            {
              narration: "Halo.",
              delivery: "dialogue",
              shots: [
                { role: "Shot 1", angle: "medium", visualFunction: "bicara", prompt: `${long} @character_budi at @location_home_office said: "Halo."` },
                { role: "Shot 2", angle: "insert", visualFunction: "tangan", prompt: `${long} Close-up on @character_budi's hands holding @property_old_photo.` },
                { role: "Shot 3", angle: "close", visualFunction: "buku", prompt: `${long} Extreme close-up on the cover of @property_bank_book.` },
              ],
            },
          ],
        },
      ],
    }) as VoiceOverScript;
    expect(speechNeedsRepair(dialog, "dialog")).toBe(true);
    expect(speechNeedsRepair({ ...dialog, speech: "silent" }, "silent")).toBe(true);
    const mix = parseVoiceOverScript({
      speech: "mix",
      scenes: [
        {
          title: "SCENE 1",
          lines: [
            { narration: "Narasi.", delivery: "vo", shots: [{ role: "Shot 1", angle: "wide", visualFunction: "lihat", prompt: "A quiet street." }, { role: "Shot 2", angle: "close", visualFunction: "detail", prompt: "The envelope on the table." }] },
            ...dialog.scenes[0].lines,
          ],
        },
      ],
    }) as VoiceOverScript;
    expect(speechNeedsRepair(mix, "mix")).toBe(true);
    const repair = buildSpeechRepairPrompt({
      ideaStatement: "Budi menunda investasi.",
      pillarName: "B-Roll Storytelling",
      speech: "vo",
      script: hands,
    });
    expect(repair).toContain("missing a @location token");
    expect(repair).toContain("@character_budi");
  });

  it("asks the repair to return only the failing lines", () => {
    const script = parseVoiceOverScript(sample) as VoiceOverScript;
    const prompt = buildLineRepairPrompt({
      ideaStatement: "Reuni geng motor membuka obrolan uang sekolah.",
      masterStatement: "Kenaikan penjualan tidak hanya disebabkan oleh iklan.",
      ancestors: [{ label: "Big Thought", statement: "Kemudahan memperoleh mengalahkan keinginan memiliki." }],
      pillarName: "Handling Objections",
      script: { ...script, lineIssues: [{ lineId: "s1-l1", reason: "pesan Idea" }] },
    });
    expect(prompt).toContain("only the narration lines that failed");
    expect(prompt).toContain("not an advertisement");
    expect(prompt).toContain("can say the Master Thought");
    expect(prompt).toContain("Do not stop at the mechanism");
    expect(prompt).toContain("Do not install another cause");
    expect(prompt).toContain("Kenaikan penjualan tidak hanya disebabkan oleh iklan.");
    expect(prompt).toContain("Big Thought: Kemudahan memperoleh mengalahkan keinginan memiliki.");
    expect(prompt).toContain("more than one shot");
    expect(prompt).toContain("s1-l1");
    expect(prompt).not.toContain("industry");
  });

  it("fails a closing line that installs a cause outside the belief chain", () => {
    const prompt = buildLineAuditPrompt({
      ideaStatement: "Satu barang kecil ditambahkan di kasir.",
      masterStatement: "Kenaikan penjualan tidak hanya disebabkan oleh iklan.",
      ancestors: [{ label: "Big Thought", statement: "Kemudahan memperoleh mengalahkan keinginan memiliki." }],
      lines: [
        { id: "s5-l1", narration: "Ini bukan tentang harga atau kebutuhan, tapi tentang angka yang pas." },
        { id: "s3-l1", narration: "Mata tertuju pada sesuatu yang kecil dan mudah dijangkau." },
      ],
    });
    expect(prompt).toContain("not an advertisement");
    expect(prompt).toContain("conclusion scene");
    expect(prompt).toContain("must be able to say the Master Thought");
    expect(prompt).toContain("fitting number");
    expect(prompt).toContain("only shows the Idea's mechanism does not fail");
    expect(prompt).toContain("Kenaikan penjualan tidak hanya disebabkan oleh iklan.");
    expect(prompt).toContain("Big Thought: Kemudahan memperoleh mengalahkan keinginan memiliki.");
    expect(prompt).toContain("s5-l1: Ini bukan tentang harga atau kebutuhan");
    expect(prompt).toContain("s3-l1: Mata tertuju pada sesuatu yang kecil");
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
