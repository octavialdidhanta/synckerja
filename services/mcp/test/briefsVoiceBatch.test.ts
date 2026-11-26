import { describe, expect, it, vi } from "vitest";
import { generateBriefVoiceInput, generateBriefVoiceResult } from "../src/tools/content/briefsVoiceGenerate";

const planId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ctx = { userId: "u", organizationId: "o" } as never;

const brief = {
  voice_over: "Seluruh VO panjang.",
  storyboard: {
    sequences: [
      {
        shots: [
          { vo: "Baris satu.", has_voice: true, voice_stale: false },
          { vo: "", has_voice: false },
          { vo: "Baris tiga.", has_voice: true, voice_stale: true },
          { vo: "Baris empat.", has_voice: false },
        ],
      },
    ],
  },
} as never;

const fakeClip = (row: number) => ({ clip: { id: `c${row}`, row_index: row, download_url: `u${row}` } }) as never;

describe("content.briefs.voice.generate batch", () => {
  it("accepts exactly one of row_index, row_indexes, all_rows; text only for one row", () => {
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId, all_rows: true }).success).toBe(true);
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId, row_indexes: [0, 2] }).success).toBe(true);
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId }).success).toBe(false);
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId, row_index: 0, all_rows: true }).success).toBe(false);
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId, all_rows: true, text: "x" }).success).toBe(false);
  });

  it("generates every row with its own vo, never the whole voice_over, and retries a failed row once", async () => {
    let failsLeft = 1;
    const generate = vi.fn(async (_c, input: { rowIndex: number; text: string }) => {
      if (input.rowIndex === 3 && failsLeft-- > 0) throw new Error("elevenlabs_timeout");
      return fakeClip(input.rowIndex);
    });
    const res = (await generateBriefVoiceResult(ctx, { plan_id: planId, all_rows: true }, generate, async () => brief)) as {
      clips: Array<{ row_index: number }>;
      failed: unknown[];
      skipped: Array<{ row_index: number; reason: string }>;
    };
    expect(res.clips.map((c) => c.row_index)).toEqual([0, 2, 3]);
    expect(res.failed).toEqual([]);
    expect(res.skipped).toEqual([{ row_index: 1, reason: "no_vo_text" }]);
    expect(generate.mock.calls.map((c) => c[1].text)).not.toContain("Seluruh VO panjang.");
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it("only_missing skips current clips; a row failing twice lands in failed", async () => {
    const generate = vi.fn(async (_c, input: { rowIndex: number }) => {
      if (input.rowIndex === 2) throw new Error("boom");
      return fakeClip(input.rowIndex);
    });
    const res = (await generateBriefVoiceResult(
      ctx,
      { plan_id: planId, all_rows: true, only_missing: true },
      generate,
      async () => brief,
    )) as { clips: Array<{ row_index: number }>; failed: Array<{ row_index: number; error: string }>; skipped: unknown[] };
    expect(res.clips.map((c) => c.row_index)).toEqual([3]);
    expect(res.failed).toEqual([{ row_index: 2, error: "boom" }]);
    expect(res.skipped).toContainEqual({ row_index: 0, reason: "clip_current" });
  });
});
