import { describe, expect, it } from "vitest";
import type { ProductBeliefSourceRow } from "@/thinking-lab/master-thought/productBrief";
import {
  buildProductReasonPool,
  readProductReasonPool,
  statementUsesReason,
} from "@/thinking-lab/master-thought/productReasonPool";
import { buildGeneratePrompt, keepGroundedBigThoughts, parseGeneratedBigThoughts } from "@/thinking-lab/big-thought/generate";

const row: ProductBeliefSourceRow = {
  category: "Sate",
  subCategory: "",
  feature: "Arang sendiri",
  featureDescription: "Dibakar di warung",
  solution: "Bumbu racikan warung",
  competitiveAdvantage: "Tanpa minyak jelantah",
  customerPersona: "",
  problem: "",
  impact: "",
  wants: "",
  needs: "",
  hiddenNeeds: "",
  falseBelief: "",
  falseBeliefImpact: "",
  whatMakesThemStop: "",
};

describe("product reason pool", () => {
  it("freezes feature, solution, and advantage text", () => {
    const pool = buildProductReasonPool("Sate Pak Kumis", [row]);
    expect(pool.serviceName).toBe("Sate Pak Kumis");
    expect(pool.items.map((item) => item.kind)).toEqual(["feature", "solution", "advantage"]);
    expect(pool.items[0]?.text).toBe("Arang sendiri. Dibakar di warung");
    expect(pool.items.map((item) => item.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("reads an empty stored pool and treats a missing column as general", () => {
    expect(readProductReasonPool(null)).toBeNull();
    expect(readProductReasonPool(undefined)).toBeNull();
    expect(readProductReasonPool({})).toBeNull();
    expect(readProductReasonPool({ serviceName: "Sate Pak Kumis", items: [] })).toEqual({
      serviceName: "Sate Pak Kumis",
      items: [],
    });
  });

  it("keeps a clause that uses the cited reason and drops an outside reason", () => {
    const pool = buildProductReasonPool("Sate Pak Kumis", [row]);
    expect(statementUsesReason("Sate ini layak karena bumbunya tanpa minyak jelantah", "Tanpa minyak jelantah")).toBe(true);
    expect(statementUsesReason("Komplek ini punya standar kuliner yang tinggi untuk setiap tenant", "Tanpa minyak jelantah")).toBe(
      false,
    );
    const prompt = buildGeneratePrompt({
      parentStatement: "Sate yang layak dibanggakan ada di dalam komplek.",
      incumbents: [],
      needed: 3,
      missingWhy: null,
      reasonPool: pool,
    });
    expect(prompt).toContain("r3 advantage");
    expect(prompt).toContain("Tanpa minyak jelantah");
    expect(prompt).toContain("reasonId");
    expect(prompt).not.toContain("Do not use examples from any specific industry, belief system, or brand.");
    const general = buildGeneratePrompt({
      parentStatement: "Sate yang layak dibanggakan ada di dalam komplek.",
      incumbents: [],
      needed: 3,
      missingWhy: null,
    });
    expect(general).toContain("Do not use examples from any specific industry, belief system, or brand.");
    expect(general).not.toContain("Allowed product reasons");
    const parsed = parseGeneratedBigThoughts(
      {
        items: [
          { label: "Minyak", statement: "bumbunya tanpa minyak jelantah", reasonId: "r3" },
          { label: "Tenant", statement: "setiap tenant punya standar tinggi", reasonId: "missing" },
          { label: "Kosong", statement: "tanpa alasan" },
        ],
      },
      "",
      pool,
    );
    expect(parsed.map((item) => item.reasonId)).toEqual(["r3"]);
    expect(
      keepGroundedBigThoughts(
        [
          { label: "Minyak", statement: "bumbunya tanpa minyak jelantah", reasonId: "r3" },
          { label: "Salah", statement: "setiap tenant punya standar tinggi", reasonId: "r3" },
        ],
        pool,
      ).map((item) => item.label),
    ).toEqual(["Minyak"]);
  });
});
