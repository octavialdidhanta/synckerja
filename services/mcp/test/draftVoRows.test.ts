import { describe, expect, it } from "vitest";
import { draftRenderJobResult, type VoRowLookup } from "../src/tools/render/draft";

const ctx = { userId: "u", organizationId: "o" } as never;
const w = (text: string, start: number, end: number) => ({ text, start, end });
const CLIPS: Record<number, { duration_seconds: number; words: ReturnType<typeof w>[]; file_name: string }> = {
  2: { duration_seconds: 2.5, words: [w("Satu.", 0.1, 0.6), w("Angkat", 0.9, 1.4), w("tulangnya.", 1.45, 2.4)], file_name: "vo-3.mp3" },
  3: { duration_seconds: 2.61, words: [w("Sruput", 0.16, 0.56), w("dulu", 0.64, 1.04), w("yang", 1.12, 1.2), w("gampang", 1.28, 1.52), w("keluar.", 1.6, 2.56)], file_name: "vo-4.mp3" },
};
const lookupVoice: VoRowLookup = async (_c, _p, row) => CLIPS[row] ?? null;
const gaya = async () => ({ teks: "- Subtitle (STANDAR): Poppins Bold krem #FAF8B2 garis tepi #282000. Tanpa animasi, langsung ganti tiap frasa." });

const base = {
  title: "t",
  plan_id: "6d1ff665-7412-4bd2-b563-5f2a50e4f460",
  production: "6d1ff665 Tes",
  output_name: "6d1ff665_Tes_VO_v1_9x16",
  shots: [{ file_key: "PIK1/a.mp4", in: 0, out: 8 }],
};

describe("render.jobs.draft vo_rows", () => {
  it("places each row's clip, writes vo_parts and subtitles from the words", async () => {
    const r = (await draftRenderJobResult(ctx, { ...base, vo_rows: [{ row_index: 2 }, { row_index: 3 }, { silence: 1.5 }] }, gaya, undefined, undefined, undefined, lookupVoice)) as {
      spec: { audio: { vo_parts?: Array<{ file: string; at: number }> }; texts: Array<{ text: string; start: number; style: string; anim: string }> };
      vo_timeline: Array<{ row_index: number | null; start: number; end: number }>;
      vo_end_seconds: number;
    };
    expect(r.spec.audio.vo_parts).toEqual([
      { file: "vo/vo-3.mp3", at: 0.05, db: 0 },
      { file: "vo/vo-4.mp3", at: 2.75, db: 0 },
    ]);
    expect(r.spec.texts.map((t) => [t.text, t.start, t.anim])).toEqual([
      ["Satu.", 0.15, "none"],
      ["Angkat tulangnya.", 0.95, "none"],
      ["Sruput dulu yang gampang keluar.", 2.91, "none"],
    ]);
    expect(r.vo_timeline.at(-1)).toEqual({ row_index: null, file: null, start: 5.56, end: 7.06 });
    expect(r.vo_end_seconds).toBe(7.06);
  });

  it("refuses a row without a clip, and vo_file together with vo_rows", async () => {
    await expect(draftRenderJobResult(ctx, { ...base, vo_rows: [{ row_index: 9 }] }, gaya, undefined, undefined, undefined, lookupVoice)).rejects.toThrow(/row 9/);
    await expect(
      draftRenderJobResult(ctx, { ...base, vo_file: "vo/VO_full.mp3", vo_rows: [{ row_index: 2 }] }, gaya, undefined, undefined, undefined, lookupVoice),
    ).rejects.toThrow(/not both/);
  });
});
