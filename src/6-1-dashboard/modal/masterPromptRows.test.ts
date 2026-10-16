import { describe, expect, it } from "vitest";
import { masterPromptRowSpans } from "@/6-1-dashboard/modal/masterPromptRows";

describe("master prompt row spans", () => {
  it("merges the empty shot rows of one narration and stops at the next voice-over", () => {
    const rows = [
      ["Di usia 30.", "Shot 1", "prompt 1", "Shot 1\n\nShot 2\n\nShot 3"],
      ["", "Shot 2", "prompt 2", ""],
      ["", "Shot 3", "prompt 3", ""],
      ["Tapi rasa penasaran.", "Shot 1", "prompt 4", "Shot 1 only"],
    ];
    expect(masterPromptRowSpans({
      rows,
      masterColumn: 3,
      voiceColumn: 0,
      ranges: [{ startRow: 0, endRow: 4 }],
    })).toEqual([{ row: 0, span: 3 }]);
  });

  it("does not merge across a sequence boundary", () => {
    const rows = [
      ["Kalimat satu.", "Shot 1", "master satu"],
      ["", "Shot 2", ""],
      ["Kalimat dua.", "Shot 1", "master dua"],
    ];
    expect(masterPromptRowSpans({
      rows,
      masterColumn: 2,
      voiceColumn: 0,
      ranges: [
        { startRow: 0, endRow: 2 },
        { startRow: 2, endRow: 3 },
      ],
    })).toEqual([{ row: 0, span: 2 }]);
  });
});
