import { describe, expect, it } from "vitest";
import { mapGenerateError } from "../src/db/briefVoice";
import { generateBriefVoiceResult } from "../src/tools/content/briefsVoiceGenerate";

describe("ElevenLabs credit exhausted", () => {
  it("maps 402, the code and the Indonesian message to voice_credit_exhausted; other errors keep their codes", () => {
    expect(mapGenerateError(402, "x").message).toBe("voice_credit_exhausted");
    expect(mapGenerateError(401, "", "voice_credit_exhausted").message).toBe("voice_credit_exhausted");
    expect(mapGenerateError(500, "Kredit ElevenLabs habis, jadi VO belum bisa dibuat.").message).toBe("voice_credit_exhausted");
    expect(mapGenerateError(401, "Invalid API key").message).toBe("voice_generate_failed");
    expect(mapGenerateError(429, "").message).toBe("rate_limited");
  });
});

describe("batch stops on a spent ElevenLabs balance", () => {
  const ctx = { userId: "u", organizationId: "o" } as never;
  const brief = {
    voice_over: "",
    storyboard: { sequences: [{ shots: [1, 2, 3, 4, 5].map((n) => ({ vo: `Baris ${n}.`, has_voice: false })) }] },
  } as never;

  it("does not retry and does not call ElevenLabs for the other rows", async () => {
    let calls = 0;
    const generate = async () => {
      calls++;
      throw new Error("voice_credit_exhausted");
    };
    const res = (await generateBriefVoiceResult(
      ctx,
      { plan_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", all_rows: true },
      generate as never,
      async () => brief,
    )) as { clips: unknown[]; failed: Array<{ row_index: number; error: string }> };
    expect(res.clips).toEqual([]);
    expect(res.failed.map((f) => f.error)).toEqual(Array(5).fill("voice_credit_exhausted"));
    expect(calls).toBeLessThanOrEqual(3); // at most the rows already in flight (3 at a time), never a retry
  });
});
