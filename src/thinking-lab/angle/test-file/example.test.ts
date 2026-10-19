import { describe, expect, it } from "vitest";
import { angleExampleProblem, normalizeAngleExample } from "@/thinking-lab/angle/example";

const explanation =
  "Pembelian berlebih seringkali menggeser fokus dari nilai guna barang menjadi sekadar kepemilikan, sehingga mengurangi apresiasi terhadap apa yang sudah ada.";

describe("angle example", () => {
  it("rejects an explanation that has no pictured situation", () => {
    expect(angleExampleProblem("", explanation)).toBe("This Angle has no example.");
    expect(angleExampleProblem("Baju baru", explanation)).toBe("The example is too thin to picture.");
    expect(angleExampleProblem(explanation, explanation)).toBe("The example only repeats the explanation.");
  });

  it("keeps one concrete situation and drops the leading label", () => {
    const example = normalizeAngleExample(
      "Misalnya, lemari sudah penuh baju, tapi yang terasa kurang selalu baju yang belum dibeli.",
    );
    expect(example.startsWith("Lemari sudah penuh")).toBe(true);
    expect(example.toLowerCase().startsWith("misalnya")).toBe(false);
    expect(angleExampleProblem(example, explanation)).toBe("");
  });
});
