import { describe, expect, it } from "vitest";
import {
  activeVoSlide,
  clipForNarration,
  adjustVoVersionsForDeleteRow,
  adjustVoVersionsForInsertRow,
  briefVersionName,
  parseBriefVoVersions,
  rememberVoVersion,
  rememberVoVersions,
  narrationAnchorRow,
  savedVoSlides,
  upsertBriefVoVersionsInMarkdown,
} from "./briefVoVersions";

describe("brief VO versions", () => {
  it("keeps an empty later shot on the narration that started the sentence", () => {
    const rows = [
      ["Banyak yang percaya tempat makan di dalam komplek pasti seadanya."],
      [""],
      ["Shot berikutnya mulai kalimat baru."],
    ];
    expect(narrationAnchorRow(rows, 0, 0)).toBe(0);
    expect(narrationAnchorRow(rows, 0, 1)).toBe(0);
    expect(narrationAnchorRow(rows, 0, 2)).toBe(2);
    expect(narrationAnchorRow([[""], [""]], 0, 1)).toBe(-1);
    expect(narrationAnchorRow(rows, -1, 0)).toBe(-1);
  });

  it("names the first slide Original and the rest V.1, V.2", () => {
    expect(briefVersionName(0)).toBe("Original");
    expect(briefVersionName(1)).toBe("V.1");
    expect(briefVersionName(2)).toBe("V.2");
  });

  it("keeps the previous line when a new line is saved", () => {
    const first = rememberVoVersion([], 0, "Serius loo?", "[curious] Serius loo?");
    expect(first).toEqual([{ row: 0, versions: ["Serius loo?", "[curious] Serius loo?"] }]);
    const second = rememberVoVersion(first, 0, "[curious] Serius loo?", "[playful] Serius loo?");
    expect(second[0]?.versions).toEqual([
      "Serius loo?",
      "[curious] Serius loo?",
      "[playful] Serius loo?",
    ]);
  });

  it("does not add a slide when the saved line is unchanged", () => {
    const history = rememberVoVersion([], 0, "Serius loo?", "[curious] Serius loo?");
    expect(rememberVoVersion(history, 0, "[curious] Serius loo?", "[curious] Serius loo?")).toBe(history);
  });

  it("waits for a second save before keeping history", () => {
    expect(rememberVoVersion([], 0, "", "Serius loo?")).toEqual([]);
  });

  it("records only the voice-over column", () => {
    const result = rememberVoVersions(
      [],
      ["Shot", "VO (Voice Over)"],
      [["1", "Serius loo?"]],
      [["1", "[curious] Serius loo?"]],
    );
    expect(result.changedRows).toEqual([0]);
    expect(result.history[0]?.versions).toEqual(["Serius loo?", "[curious] Serius loo?"]);
  });

  it("round-trips versions stored in the brief", () => {
    const markdown = upsertBriefVoVersionsInMarkdown("# Brief", [
      { row: 1, versions: ["[curious] Original", "V.1 line --> extra"] },
    ]);
    expect(markdown).toContain("synckerja-brief-vo-versions:");
    expect(markdown).not.toContain("--> extra");
    expect(parseBriefVoVersions(markdown)).toEqual([
      { row: 1, versions: ["[curious] Original", "V.1 line --> extra"] },
    ]);
  });

  it("shifts versions with the row they belong to", () => {
    const history = [
      { row: 0, versions: ["a", "b"] },
      { row: 1, versions: ["c", "d"] },
    ];
    expect(adjustVoVersionsForInsertRow(history, 1).map((item) => item.row)).toEqual([0, 2]);
    expect(adjustVoVersionsForDeleteRow(history, 0).map((item) => item.row)).toEqual([0]);
  });

  it("plays the clip spoken from the open line", () => {
    const original = { spoken_text: "[disbelieving] Serius loo? [questioning] makan enak di Pik itu harus keluar komplek?" };
    const latest = { spoken_text: `${original.spoken_text} gw mah ngga percaya ya` };
    const clips = [latest, original];
    expect(clipForNarration(clips, original.spoken_text)).toBe(original);
    expect(clipForNarration(clips, "Serius loo? makan enak di Pik itu harus keluar komplek?")).toBe(original);
    expect(clipForNarration(clips, latest.spoken_text)).toBe(latest);
    expect(clipForNarration(clips, "A line that was never generated")).toBeNull();
  });

  it("opens the newest slide unless an older one is selected", () => {
    expect(savedVoSlides([{ row: 2, versions: ["a", "b"] }], 2, "b")).toEqual(["a", "b"]);
    expect(activeVoSlide(undefined, 2)).toBe(1);
    expect(activeVoSlide(0, 2)).toBe(0);
  });
});
