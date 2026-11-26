import { describe, expect, it } from "vitest";
import { buildVoTimeline, phrases } from "../src/tools/render/voTimeline";

const w = (text: string, start: number, end: number) => ({ text, start, end });
/** "Sruput dulu yang gampang keluar." as ElevenLabs timed it on 26 Nov 2026. */
const SRUPUT = [w("Sruput", 0.16, 0.56), w("dulu", 0.64, 1.04), w("yang", 1.12, 1.2), w("gampang", 1.28, 1.52), w("keluar.", 1.6, 2.56)];
const SATU = [w("Satu.", 0.1, 0.6), w("Angkat", 0.9, 1.4), w("tulangnya.", 1.45, 2.4)];

describe("VO timeline", () => {
  it("splits phrases on full stops and keeps one-word phrases like 'Satu.'", () => {
    expect(phrases(SATU).map((p) => p.map((x) => x.text).join(" "))).toEqual(["Satu.", "Angkat tulangnya."]);
    expect(phrases(SRUPUT).map((p) => p.length)).toEqual([5]);
  });

  it("places rows one after another and shifts later rows when a clip gets longer", () => {
    const rows = (d: number) => [
      { kind: "clip" as const, row_index: 2, file: "vo/vo-3.mp3", duration: 2.5, words: SATU },
      { kind: "clip" as const, row_index: 3, file: "vo/vo-4.mp3", duration: d, words: SRUPUT },
      { kind: "silence" as const, row_index: 8, seconds: 1.5 },
      { kind: "clip" as const, row_index: 9, file: "vo/vo-10.mp3", duration: 0.8, words: [w("Bersih.", 0.1, 0.7)] },
    ];
    const a = buildVoTimeline(rows(2.61));
    expect(a.parts).toEqual([
      { file: "vo/vo-3.mp3", at: 0.05 },
      { file: "vo/vo-4.mp3", at: 2.75 },
      { file: "vo/vo-10.mp3", at: 7.06 },
    ]);
    expect(a.timeline[2]).toEqual({ row_index: 8, file: null, start: 5.56, end: 7.06 });
    const b = buildVoTimeline(rows(3.01));
    expect(b.parts[2]!.at).toBe(7.46);
    expect(b.subtitles.find((s) => s.text === "Bersih.")!.start).toBe(7.56);
  });

  it("times subtitles from the words, with word timings on the final video", () => {
    const t = buildVoTimeline([{ kind: "clip", row_index: 3, file: "vo/vo-4.mp3", duration: 2.61, words: SRUPUT }], { start: 9.1 });
    expect(t.subtitles).toEqual([
      {
        text: "Sruput dulu yang gampang keluar.",
        start: 9.26,
        end: 11.76,
        words: SRUPUT.map((x) => ({ text: x.text, start: Math.round((9.1 + x.start) * 1000) / 1000, end: Math.round((9.1 + x.end) * 1000) / 1000 })),
      },
    ]);
  });
});
