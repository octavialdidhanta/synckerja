import { describe, expect, it, vi } from "vitest";
import { isNoVoMarker, timingSeconds } from "../src/tools/content/voMarker";
import { generateBriefVoiceResult } from "../src/tools/content/briefsVoiceGenerate";
import { draftRenderJobResult, type BriefLookup, type VoRowLookup } from "../src/tools/render/draft";

const ctx = { userId: "u", organizationId: "o" } as never;
const planId = "6d1ff665-7412-4bd2-b563-5f2a50e4f460";

describe("isNoVoMarker", () => {
  it("marks natural-sound and pause cells, keeps real narration", () => {
    for (const t of ["(suara asli)", "(Natural sound)", "-", "—", " – ", "", "[pause]", "[matter-of-fact](suara asli)", "(SFX sruput)", "Suara asli", "tanpa VO"]) {
      expect(isNoVoMarker(t), t).toBe(true);
    }
    for (const t of ["Bersih.", "Satu. Angkat tulangnya.", "[conversational] Makan sumsum, setengahnya masih nyangkut.", "Sate (babi) paling empuk", "Dua."]) {
      expect(isNoVoMarker(t), t).toBe(false);
    }
  });

  it("reads storyboard timing ranges", () => {
    expect(timingSeconds("16–18")).toBe(2);
    expect(timingSeconds("23-27s")).toBe(4);
    expect(timingSeconds("0,5–2")).toBe(1.5);
    expect(timingSeconds("Slide 2")).toBeNull();
    expect(timingSeconds(null)).toBeNull();
  });
});

describe("content.briefs.voice.generate never reads a no-VO marker aloud", () => {
  const brief = {
    voice_over: "VO.",
    storyboard: {
      sequences: [
        {
          shots: [
            { vo: "Tiga. Taruh di atas nasi.", has_voice: false },
            { vo: "(suara asli)", has_voice: false },
            { vo: "-", has_voice: false },
            { vo: "Bersih.", has_voice: false },
          ],
        },
      ],
    },
  } as never;

  it("batch skips marker rows with reason no_vo_marker", async () => {
    const generate = vi.fn(async (_c, input: { rowIndex: number }) => ({ clip: { id: `c${input.rowIndex}` } }) as never);
    const res = (await generateBriefVoiceResult(ctx, { plan_id: planId, all_rows: true, only_missing: true }, generate, async () => brief)) as {
      clips: Array<{ row_index: number }>;
      skipped: Array<{ row_index: number; reason: string }>;
    };
    expect(res.clips.map((c) => c.row_index)).toEqual([0, 3]);
    expect(res.skipped).toEqual([
      { row_index: 1, reason: "no_vo_marker" },
      { row_index: 2, reason: "no_vo_marker" },
    ]);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("a single marker row is refused, but explicit words for it still work", async () => {
    const generate = vi.fn(async () => ({ clip: { id: "c" } }) as never);
    await expect(generateBriefVoiceResult(ctx, { plan_id: planId, row_index: 1 }, generate, async () => brief)).rejects.toThrow(/silence/);
    expect(generate).not.toHaveBeenCalled();
    await generateBriefVoiceResult(ctx, { plan_id: planId, row_index: 1, text: "Mmm, empuk." }, generate, async () => brief);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("render.jobs.draft turns a no-VO row into silence", () => {
  const w = (text: string, start: number, end: number) => ({ text, start, end });
  // Row 1 has a clip that was made by mistake and reads "(suara asli)" aloud: it must not be used.
  const CLIPS: Record<number, { duration_seconds: number; words: ReturnType<typeof w>[]; file_name: string }> = {
    0: { duration_seconds: 2, words: [w("Kasih", 0.1, 0.5), w("kuahnya.", 0.6, 1.9)], file_name: "vo-1.mp3" },
    1: { duration_seconds: 1.02, words: [w("(suara", 0.15, 0.37), w("asli)", 0.48, 0.96)], file_name: "vo-2.mp3" },
    2: { duration_seconds: 1, words: [w("Bersih.", 0.1, 0.9)], file_name: "vo-3.mp3" },
  };
  const lookupVoice: VoRowLookup = async (_c, _p, row) => CLIPS[row] ?? null;
  const getBrief: BriefLookup = async () => ({
    title: "t",
    caption: null,
    voice_over: null,
    rows: [
      { vo: "Kasih kuahnya.", timing: "14–16" },
      { vo: "(suara asli)", timing: "16–18" },
      { vo: "Bersih.", timing: "18–20" },
    ],
  });
  const gaya = async () => ({});

  it("uses the storyboard timing as the pause, skips the clip, keeps the row's shots", async () => {
    const r = (await draftRenderJobResult(
      ctx,
      {
        title: "t",
        plan_id: planId,
        production: "p",
        output_name: "o",
        vo_rows: [
          { row_index: 0, shots: [{ file_key: "a.mp4" }] },
          { row_index: 1, shots: [{ file_key: "b.mp4" }] },
          { row_index: 2, shots: [{ file_key: "c.mp4" }] },
        ],
      },
      gaya,
      async () => ({ duration_seconds: 10 }),
      getBrief,
      undefined,
      lookupVoice,
    )) as {
      spec: { audio: { vo_parts: Array<{ file: string }> }; shots: Array<{ file_key: string }>; texts: Array<{ text: string }> };
      vo_timeline: Array<{ row_index: number | null; file: string | null; start: number; end: number }>;
      warnings: string[];
    };
    expect(r.spec.audio.vo_parts.map((p) => p.file)).toEqual(["vo/vo-1.mp3", "vo/vo-3.mp3"]);
    const row1 = r.vo_timeline.find((t) => t.row_index === 1)!;
    expect(row1.file).toBeNull();
    expect(Math.round((row1.end - row1.start) * 100) / 100).toBe(2);
    expect(r.spec.shots.map((s) => s.file_key)).toEqual(["a.mp4", "b.mp4", "c.mp4"]);
    expect(r.spec.texts.map((t) => t.text).join(" ")).not.toMatch(/suara asli/);
    expect(r.warnings.some((x) => /baris 1: .*jeda 2 s/.test(x))).toBe(true);
  });
});
