import { describe, expect, it } from "vitest";
import {
  MASTER_CHECK_IDS,
  MASTER_CHECK_RULES,
  buildBeliefOptionsPrompt,
  buildWrittenBeliefCheckPrompt,
  checkWrittenBelief,
  masterCheckIds,
  parseWrittenBeliefCheck,
} from "@/thinking-lab/master-thought/semantic";

const promo = "Sate kambing Warung Contoh berani diadu juicy-nya sama wagyu. Nggak puas? Kami garansi rasa.";
const catalog = { category: "Warung Contoh", subCategories: ["Iga Bakar Kambing Muda"], features: ["Daging Empuk"] };

describe("written Master Thought check", () => {
  it("judges every rule with its exact words, the audience, and the catalog names", () => {
    const prompt = buildWrittenBeliefCheckPrompt({
      belief: promo,
      priorBelief: "Sate kambing cuma makanan murah.",
      audience: "Pecinta steak",
      catalog,
    });
    for (const id of MASTER_CHECK_IDS) expect(prompt).toContain(`${id}: ${MASTER_CHECK_RULES[id]}`);
    expect(prompt).toContain("Pecinta steak");
    expect(prompt).toContain("Iga Bakar Kambing Muda");
    expect(prompt).toContain("Daging Empuk");
  });

  it("asks shift only with an old belief and audience language only with an audience", () => {
    expect(masterCheckIds({})).toEqual(["oneClaim", "oneSentence", "notPromo", "noBrand", "subjectClear", "accountable"]);
    expect(masterCheckIds({ priorBelief: "x", audience: "y" })).toEqual([...MASTER_CHECK_IDS]);
  });

  it("every rule is written in Indonesian and none allows a brand", () => {
    for (const rule of Object.values(MASTER_CHECK_RULES)) expect(rule).toMatch(/^(Lolos|Gagal)/);
    expect(MASTER_CHECK_RULES.notPromo).not.toContain("product claim");
  });

  it("returns the reasons of failed checks and refuses an answer that skips a check", () => {
    const ids = ["oneClaim", "oneSentence", "notPromo"];
    expect(
      parseWrittenBeliefCheck(
        { checks: [{ id: "oneClaim", pass: true }, { id: "oneSentence", pass: false, reason: "Tiga kalimat." }, { id: "notPromo", pass: false, reason: "Kami garansi rasa." }] },
        ids,
      ),
    ).toEqual({ pass: false, reasons: ["Tiga kalimat.", "Kami garansi rasa."] });
    expect(parseWrittenBeliefCheck({ checks: [{ id: "oneClaim", pass: true }] }, ids)).toBeNull();
  });

  it("refuses a belief before any model call while no category is linked, even with every check OFF", async () => {
    let calls = 0;
    const result = await checkWrittenBelief({ belief: promo, catalog: null, skip: [...MASTER_CHECK_IDS] }, async () => {
      calls += 1;
      return null;
    });
    expect(calls).toBe(0);
    expect(result).toEqual({ pass: false, reasons: ["CATALOG_REQUIRED"] });
  });

  it("an unreadable answer twice never lets the belief through", async () => {
    let calls = 0;
    const result = await checkWrittenBelief({ belief: promo, catalog }, async () => {
      calls += 1;
      return "not json";
    });
    expect(calls).toBe(2);
    expect(result).toEqual({ pass: false, reasons: ["UNDECIDED"] });
  });

  it("belief options leave the promotion and the brand out", () => {
    const prompt = buildBeliefOptionsPrompt({ planted: promo, catalog });
    expect(prompt).toContain("Do not carry the promotion into any belief.");
    expect(prompt).toContain(MASTER_CHECK_RULES.noBrand);
    expect(prompt).toContain(MASTER_CHECK_RULES.subjectClear);
  });
});
