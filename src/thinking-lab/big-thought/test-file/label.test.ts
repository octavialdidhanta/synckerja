import { describe, expect, it } from "vitest";
import { parseGeneratedBigThoughts } from "@/thinking-lab/big-thought/generate";
import {
  bigThoughtHeading,
  bigThoughtTreeCode,
  buildBigThoughtLabelPrompt,
  buildKeyBeliefFromLabelPrompt,
  normalizeBigThoughtLabel,
  parseBigThoughtLabels,
  parseKeyBeliefFromLabel,
  readBigThoughtLabel,
} from "@/thinking-lab/big-thought/label";

describe("big thought labels", () => {
  it("keeps a heading of 1 to 3 words", () => {
    expect(normalizeBigThoughtLabel("  Karakter Bahan. ")).toBe("Karakter Bahan");
    expect(normalizeBigThoughtLabel("Satu dua tiga empat lima")).toBe("Satu dua tiga");
    expect(normalizeBigThoughtLabel("Bahan")).toBe("Bahan");
  });

  it("formats the list heading and the map code without changing the belief", () => {
    const belief =
      "Bahan yang berbeda punya karakter alami yang berbeda, sehingga tidak seharusnya diperlakukan dengan cara yang sama.";
    expect(bigThoughtHeading("BT01", "Karakter Bahan")).toBe("BT01 — Karakter Bahan");
    expect(bigThoughtTreeCode("BT01", "Karakter Bahan")).toBe("BT01-Karakter Bahan");
    expect(belief).toContain("karakter alami");
  });

  it("asks only for headings and reads them back by code", () => {
    const prompt = buildBigThoughtLabelPrompt([
      { code: "BT01", statement: "Bahan yang berbeda punya karakter alami yang berbeda." },
    ]);
    expect(prompt).toContain("Do not rewrite, shorten, or replace any because-clause.");
    expect(prompt).toContain("Bahan yang berbeda punya karakter alami yang berbeda.");
    const labels = parseBigThoughtLabels({
      labels: [{ code: "bt01", label: "Karakter Bahan" }],
    });
    expect(labels.get("BT01")).toBe("Karakter Bahan");
  });

  it("accepts a 1 to 3 word label and asks the model to write the Key Belief", () => {
    expect(readBigThoughtLabel("Kualitas Hidangan")).toEqual({ ok: true, label: "Kualitas Hidangan" });
    expect(readBigThoughtLabel("Bahan")).toEqual({ ok: true, label: "Bahan" });
    expect(readBigThoughtLabel("Pengalaman makan terasa lebih memuaskan").ok).toBe(false);
    const prompt = buildKeyBeliefFromLabelPrompt({
      parentStatement: "Pengalaman makan yang berkesan dibentuk oleh perpaduan makanan, suasana, dan tempat.",
      label: "Kualitas Hidangan",
      incumbents: [{ code: "BT01", statement: "Pengalaman holistik melibatkan indra dan emosi." }],
    });
    expect(prompt).toContain("Kualitas Hidangan");
    expect(prompt).toContain("Do not change, translate, or replace the label.");
    expect(prompt).toContain("Do not restate or elaborate the Master Thought.");
    expect(prompt).toContain("Inserting because between the Master Thought and this clause must already make one sentence.");
    expect(
      parseKeyBeliefFromLabel({
        statement: "Kualitas hidangan yang dirasakan menentukan apakah perpaduan itu terasa berkesan.",
      }),
    ).toContain("Kualitas hidangan");
  });

  it("reads a label beside the statement and still accepts a statement-only reply", () => {
    expect(
      parseGeneratedBigThoughts({
        items: [{ label: "Karakter Bahan", statement: "Bahan yang berbeda punya karakter alami yang berbeda." }],
      }),
    ).toEqual([
      {
        label: "Karakter Bahan",
        statement: "Bahan yang berbeda punya karakter alami yang berbeda.",
      },
    ]);
    expect(parseGeneratedBigThoughts({ statements: ["A full statement."] })).toEqual([
      { label: "", statement: "A full statement." },
    ]);
  });
});
