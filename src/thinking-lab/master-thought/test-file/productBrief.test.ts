import { describe, expect, it } from "vitest";
import { buildProductBeliefPrompt, parseProductBeliefDraft, type ProductBeliefSourceRow } from "@/thinking-lab/master-thought/productBrief";

const row: ProductBeliefSourceRow = {
  category: "Skincare",
  subCategory: "Serum",
  feature: "Niacinamide 10%",
  featureDescription: "Menenangkan kemerahan",
  solution: "Pakai setiap malam",
  competitiveAdvantage: "Tanpa alkohol",
  customerPersona: "Wanita 25 tahun dengan kulit sensitif",
  problem: "Kulit mudah merah",
  impact: "Malu tampil tanpa makeup",
  wants: "Kulit tenang",
  needs: "Bahan yang tidak membakar",
  hiddenNeeds: "Terlihat sehat tanpa usaha besar",
  falseBelief: "Kulit sensitif harus memakai krim yang mahal",
  falseBeliefImpact: "Terus berganti produk",
  whatMakesThemStop: "Perih di aplikasi pertama",
};

describe("product belief brief", () => {
  it("sends the selected product-knowledge fields to the model", () => {
    const prompt = buildProductBeliefPrompt([row]);
    for (const label of [
      "Category: Skincare",
      "Sub Category: Serum",
      "Feature / Composition: Niacinamide 10%",
      "Feature / Composition description: Menenangkan kemerahan",
      "Solution (for feature/composition): Pakai setiap malam",
      "Competitive Advantage: Tanpa alkohol",
      "Customer Persona: Wanita 25 tahun dengan kulit sensitif",
      "Problem: Kulit mudah merah",
      "Impact: Malu tampil tanpa makeup",
      "Wants: Kulit tenang",
      "Needs: Bahan yang tidak membakar",
      "Hidden Needs: Terlihat sehat tanpa usaha besar",
      "False Belief: Kulit sensitif harus memakai krim yang mahal",
      "False Belief Impact: Terus berganti produk",
      "What Makes Them Stop: Perih di aplikasi pertama",
    ]) {
      expect(prompt).toContain(label);
    }
    expect(prompt).toContain("Read every column that is present");
  });

  it("reads one old belief, one new belief, and one audience", () => {
    expect(
      parseProductBeliefDraft({
        priorBelief: "Kulit sensitif harus memakai krim yang mahal",
        plantedBelief: "Kulit sensitif lebih tenang dengan bahan yang tidak membakar",
        audience: "Wanita 25 tahun dengan kulit sensitif",
      }),
    ).toEqual({
      priorBelief: "Kulit sensitif harus memakai krim yang mahal",
      plantedBelief: "Kulit sensitif lebih tenang dengan bahan yang tidak membakar",
      audience: "Wanita 25 tahun dengan kulit sensitif",
    });
  });

  it("rejects a new belief that repeats the old one or starts with because", () => {
    expect(
      parseProductBeliefDraft({
        priorBelief: "Krim mahal adalah satu-satunya jalan",
        plantedBelief: "Krim mahal adalah satu-satunya jalan",
        audience: "Wanita dewasa",
      }),
    ).toBeNull();
    expect(
      parseProductBeliefDraft({
        priorBelief: "Krim mahal adalah satu-satunya jalan",
        plantedBelief: "karena bahan lembut lebih penting",
        audience: "Wanita dewasa",
      }),
    ).toBeNull();
  });
});
