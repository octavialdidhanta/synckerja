import { describe, expect, it } from "vitest";
import {
  MASTER_CHECK_IDS,
  MASTER_CHECK_RULES,
  buildWrittenBeliefCheckPrompt,
  checkWrittenBelief,
  parseWrittenBeliefCheck,
} from "@/thinking-lab/master-thought/semantic";

const promo = "Sate kambing Warung Contoh berani diadu juicy-nya sama wagyu. Nggak puas? Kami garansi rasa.";
const prior = "Sate kambing cuma makanan murah.";
const catalog = { category: "Warung Contoh", subCategories: ["Iga Bakar Kambing Muda"], features: ["Daging Empuk"] };

describe("Master Thought checks", () => {
  it("has five checks in the order they are judged", () => {
    expect([...MASTER_CHECK_IDS]).toEqual(["singleClaim", "noPromoOrBrand", "subjectClear", "shift", "accountable"]);
  });

  it("judges every rule with its exact words, the old belief, and the catalog names", () => {
    const prompt = buildWrittenBeliefCheckPrompt({ belief: promo, priorBelief: prior, catalog });
    for (const id of MASTER_CHECK_IDS) expect(prompt).toContain(`${id}: ${MASTER_CHECK_RULES[id]}`);
    expect(prompt).toContain(prior);
    expect(prompt).toContain("Iga Bakar Kambing Muda");
    expect(prompt).toContain("Daging Empuk");
  });

  it("writes every rule in Indonesian", () => {
    for (const rule of Object.values(MASTER_CHECK_RULES)) expect(rule).toMatch(/^(Lolos|Gagal)/);
  });

  it("returns the reasons of failed checks and refuses an answer that skips a check", () => {
    const ids = ["singleClaim", "noPromoOrBrand"];
    expect(
      parseWrittenBeliefCheck(
        { checks: [{ id: "singleClaim", pass: false, reason: "Tiga kalimat." }, { id: "noPromoOrBrand", pass: false, reason: "Kami garansi rasa." }] },
        ids,
      ),
    ).toEqual({ pass: false, reasons: ["Tiga kalimat.", "Kami garansi rasa."] });
    expect(parseWrittenBeliefCheck({ checks: [{ id: "singleClaim", pass: true }] }, ids)).toBeNull();
  });

  it("ignores a brand fail that quotes a name the belief does not contain", async () => {
    const belief = "nasi uduk disini lebih enak pakai sop sum sum kambing";
    const answer = (reason: string) =>
      JSON.stringify({
        checks: MASTER_CHECK_IDS.map((id) => ({ id, pass: id !== "noPromoOrBrand", reason: id === "noPromoOrBrand" ? reason : "" })),
      });
    const sultan = { category: "Sate Sultan PIK", subCategories: [], features: [] };
    expect(
      await checkWrittenBelief({ belief, priorBelief: prior, catalog: sultan }, async () =>
        answer("Kalimat menyebut nama merek: 'Sate Sultan PIK'."),
      ),
    ).toEqual({ pass: true, reasons: [] });
    expect(
      await checkWrittenBelief({ belief, priorBelief: prior, catalog: sultan }, async () =>
        answer("Kalimat menyebut nama toko: 'disini'."),
      ),
    ).toEqual({ pass: false, reasons: ["Kalimat menyebut nama toko: 'disini'."] });
    expect(
      await checkWrittenBelief({ belief: promo, priorBelief: prior, catalog }, async () =>
        answer("Kalimat menyebut nama toko: 'Warung Contoh'."),
      ),
    ).toEqual({ pass: false, reasons: ["Kalimat menyebut nama toko: 'Warung Contoh'."] });
    const prompt = buildWrittenBeliefCheckPrompt({ belief, priorBelief: prior, catalog: sultan });
    expect(prompt).toContain("Judge only the words written under Belief.");
  });

  it("needs a category, an old belief, and a real shift before any model call, even with every check OFF", async () => {
    let calls = 0;
    const ask = async () => {
      calls += 1;
      return null;
    };
    const skip = [...MASTER_CHECK_IDS];
    expect(await checkWrittenBelief({ belief: promo, priorBelief: prior, catalog: null, skip }, ask)).toEqual({
      pass: false,
      reasons: ["CATALOG_REQUIRED"],
    });
    expect(await checkWrittenBelief({ belief: promo, priorBelief: " ", catalog, skip }, ask)).toEqual({
      pass: false,
      reasons: ["PRIOR_REQUIRED"],
    });
    expect(await checkWrittenBelief({ belief: `Ternyata ${prior}`, priorBelief: prior, catalog, skip }, ask)).toEqual({
      pass: false,
      reasons: ["SAME_BELIEF"],
    });
    expect(await checkWrittenBelief({ belief: promo, priorBelief: prior, catalog, skip }, ask)).toEqual({ pass: true, reasons: [] });
    expect(calls).toBe(0);
  });

  it("asks only the switched-on checks", async () => {
    let prompt = "";
    const result = await checkWrittenBelief(
      { belief: "Kambing muda bisa seempuk daging sapi premium.", priorBelief: prior, catalog, skip: ["singleClaim", "accountable"] },
      async (text) => {
        prompt = text;
        return JSON.stringify({ checks: ["noPromoOrBrand", "subjectClear", "shift"].map((id) => ({ id, pass: true })) });
      },
    );
    expect(result).toEqual({ pass: true, reasons: [] });
    expect(prompt).not.toContain("singleClaim:");
    expect(prompt).not.toContain("accountable:");
    expect(prompt).toContain("shift:");
  });

  it("an unreadable answer twice never lets the belief through", async () => {
    let calls = 0;
    const result = await checkWrittenBelief({ belief: promo, priorBelief: prior, catalog }, async () => {
      calls += 1;
      return "not json";
    });
    expect(calls).toBe(2);
    expect(result).toEqual({ pass: false, reasons: ["UNDECIDED"] });
  });
});
