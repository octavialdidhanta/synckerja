import { describe, expect, it } from "vitest";
import { autoShots, fitInScene } from "../src/tools/render/autoShots";
import { draftRenderJobResult, type VoRowLookup } from "../src/tools/render/draft";

const ctx = { userId: "u", organizationId: "o" } as never;
const w = (text: string, start: number, end: number) => ({ text, start, end });
const lookupVoice: VoRowLookup = async (_c, _p, row) =>
  row === 2
    ? { duration_seconds: 2.5, words: [w("Satu.", 0.1, 0.6), w("Angkat.", 0.9, 2.4)], file_name: "vo-3.mp3" }
    : row === 3
      ? { duration_seconds: 2.61, words: [w("Sruput", 0.16, 0.56), w("dulu.", 0.64, 2.56)], file_name: "vo-4.mp3" }
      : null;
const footage: Record<string, { duration_seconds: number; scene_starts: number[] }> = {
  "PIK1/a.mp4": { duration_seconds: 10, scene_starts: [3, 6] },
  "PIK1/b.mp4": { duration_seconds: 8, scene_starts: [] },
};
const lookupFootage = async (_c: unknown, k: string) => footage[k] ?? null;
const gaya = async () => ({});

describe("auto shots from vo_rows", () => {
  it("keeps a cut inside the scene that holds the start hint", () => {
    // scene [3,6): asking 2.5 s from 4.5 slides back so it ends before the scene change
    expect(fitInScene(footage["PIK1/a.mp4"]!, 4.5, 2.5)).toEqual({ in: 3.467, out: 5.967, short: 0 });
    // scene too short: gives what it has and reports the shortfall
    expect(fitInScene(footage["PIK1/a.mp4"]!, 3.2, 4).short).toBeGreaterThan(1);
  });

  it("one draft: shots fill each row's slot, never crossing a scene, and the shortfall rolls to the next clip", () => {
    const tl = [
      { row_index: 2, file: "f", start: 0.05, end: 2.55 },
      { row_index: 3, file: "g", start: 2.75, end: 5.36 },
    ];
    const r = autoShots(
      tl,
      [[{ file_key: "PIK1/a.mp4", in: 3.2 }], [{ file_key: "PIK1/a.mp4", in: 0 }, { file_key: "PIK1/b.mp4" }]],
      new Map(Object.entries(footage)),
    );
    const total = r.shots.reduce((t, s) => t + (s.out - s.in), 0);
    expect(total).toBeCloseTo(5.66, 1);
    for (const s of r.shots.filter((x) => x.file_key === "PIK1/a.mp4")) {
      const crosses = [3, 6].some((c) => s.in < c && s.out > c);
      expect(crosses).toBe(false);
    }
    expect(r.warnings).toEqual([]);
  });

  it("render.jobs.draft builds shots from vo_rows[].shots without a top-level shots list", async () => {
    const res = (await draftRenderJobResult(
      ctx,
      {
        title: "t",
        plan_id: "6d1ff665-7412-4bd2-b563-5f2a50e4f460",
        production: "6d1ff665 Tes",
        output_name: "6d1ff665_Tes_VO_v1_9x16",
        vo_rows: [
          { row_index: 2, shots: [{ file_key: "PIK1/a.mp4", in: 3.2 }] },
          { row_index: 3, shots: [{ file_key: "PIK1/b.mp4" }] },
        ],
      },
      gaya,
      lookupFootage,
      undefined,
      undefined,
      lookupVoice,
    )) as { spec: { shots: Array<{ file_key: string; in: number; out: number }> }; checks: { errors: unknown[] } };
    expect(res.spec.shots.map((s) => s.file_key)).toEqual(["PIK1/a.mp4", "PIK1/b.mp4"]);
    expect(res.checks.errors).toEqual([]);
  });
});
