import { describe, expect, it } from "vitest";
import { historyChargeFromItem, matchHistoryCharges, officialTokenCount, officialTokenSplit, promptExcerpt } from "../../../supabase/functions/_shared/contentUsage.ts";

describe("content usage amounts", () => {
  it("reads the official token total and ignores anything else", () => {
    expect(officialTokenCount({ usageMetadata: { totalTokenCount: 842 } })).toBe(842);
    expect(officialTokenCount({ usage: { total_tokens: 120 } })).toBe(120);
    expect(officialTokenCount({ id: "cgt-1", status: "succeeded", usage: { completion_tokens: 108900, total_tokens: 108900 } })).toBe(108900);
    expect(officialTokenCount({ usage: { total_tokens: "15" } })).toBe(15);
    expect(officialTokenCount({ usageMetadata: { totalTokenCount: 1.5 } })).toBeNull();
    expect(officialTokenCount({ usage: { prompt_tokens: 40 } })).toBeNull();
    expect(officialTokenCount(null)).toBeNull();
  });

  it("keeps Gemini answer and thinking tokens as output", () => {
    expect(officialTokenSplit({
      usageMetadata: { promptTokenCount: 3000, candidatesTokenCount: 800, thoughtsTokenCount: 562, totalTokenCount: 4362 },
    })).toEqual({ total: 4362, input: 3000, output: 1362 });
    expect(officialTokenSplit({ usage: { prompt_tokens: 40, completion_tokens: 15, total_tokens: 55 } })).toEqual({ total: 55, input: 40, output: 15 });
    expect(officialTokenSplit({ usageMetadata: { totalTokenCount: 842 } })).toEqual({ total: 842, input: null, output: null });
  });

  it("matches a history charge to the closest clip and keeps the official delta", () => {
    const item = historyChargeFromItem({
      history_item_id: "hist-1",
      date_unix: 1_700_000_100,
      character_count_change_from: 1000,
      character_count_change_to: 1186,
      text: "[strong Indonesian accent] Untuk membuktikan sebaliknya saya selenggarakan.",
      model_id: "eleven_v4",
    });
    expect(item?.amount).toBe(186);
    const at = 1_700_000_100_000;
    const matches = matchHistoryCharges(
      [
        { id: "old", at: at - 60_000, text: "Untuk membuktikan sebaliknya saya selenggarakan." },
        { id: "new", at: at + 2_000, text: "Untuk membuktikan sebaliknya saya selenggarakan." },
      ],
      item ? [item] : [],
    );
    expect(matches).toEqual([{ clipId: "new", historyId: "hist-1", amount: 186, model: "eleven_v4" }]);
    expect(historyChargeFromItem({ history_item_id: "x", date_unix: 1, character_count_change_from: 5, character_count_change_to: 4 })).toBeNull();
    const dialogue = historyChargeFromItem({
      history_item_id: "hist-v4",
      date_unix: 1_792_493_875,
      character_count_change_from: 982,
      character_count_change_to: 1077,
      text: null,
      model_id: "eleven_v4",
      dialogue: [{ text: "[strong Indonesian accent] [curious] Hasilnya? Sate dari dalam komplek.", voice_id: "voice" }],
    });
    expect(dialogue?.amount).toBe(95);
    expect(matchHistoryCharges(
      [{ id: "clip", at: 1_792_493_875_000, text: "[curious] Hasilnya? Sate dari dalam komplek." }],
      dialogue ? [dialogue] : [],
    )).toEqual([{ clipId: "clip", historyId: "hist-v4", amount: 95, model: "eleven_v4" }]);
  });

  it("keeps a short single-line excerpt", () => {
    expect(promptExcerpt("  satu   dua  ")).toBe("satu dua");
    expect(promptExcerpt("")).toBeNull();
    expect(promptExcerpt("a".repeat(200))?.endsWith("...")).toBe(true);
    expect(promptExcerpt("a".repeat(200))?.length).toBe(160);
  });
});
