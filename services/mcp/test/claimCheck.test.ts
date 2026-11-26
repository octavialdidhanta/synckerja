import { describe, expect, it } from "vitest";
import { briefTextParts, checkBriefClaims, claimWordMatcher, claimsIn, gayaClaimWords, supported } from "../src/tools/content/claimCheck";

const FNB = ["muda", "empuk", "dimasak", "rempah"];

const ctx = { userId: "u", organizationId: "o" } as never;

describe("claim check", () => {
  it("finds number, price and quality claims, not calls to action", () => {
    const fnb = claimWordMatcher(FNB);
    expect(claimsIn("Kambing muda, empuk, cukup buat 2–3 orang.", fnb)).toEqual(expect.arrayContaining(["kambing muda", "empuk", "2-3 orang"]));
    expect(claimsIn("Dimasak 6 jam, harganya cuma 35 ribu!", fnb)).toEqual(expect.arrayContaining(["6 jam", "35 ribu"]));
    expect(claimsIn("Sate paling enak se-PIK.")).toContain("paling enak");
    expect(claimsIn("Klik WhatsApp, pesan duluan. Datang tinggal makan.")).toEqual([]);
  });

  it("checks a claim against the corpus by phrase, numbers or whole words", () => {
    const corpus = "sop sumsum kambing. porsi untuk 1 orang. dimasak 6 jam dengan rempah. daging empuk.";
    expect(supported("6 jam", corpus)).toBe(true);
    expect(supported("2-3 orang", corpus)).toBe(false);
    expect(supported("empuk", corpus)).toBe(true);
    expect(supported("kambing muda", corpus)).toBe(false);
  });

  it("Green Flag case: 'kambing muda' and '2-3 orang' are warned, sourced claims pass", async () => {
    const res = await checkBriefClaims(
      ctx,
      briefTextParts({
        rows: [{ vo: "Kambing muda, dimasak 6 jam pakai rempah." }, { element: "Cukup buat 2-3 orang" }],
        caption: "Klik WhatsApp, pesan duluan.",
      }),
      {
        listCatalogProducts: async () => ({ products: [{ id: "p1", name: "Sop Sum Sum Kambing", aliases: ["sop sumsum"] }] }),
        getCatalogProduct: async () => ({
          name: "Sop Sum Sum Kambing",
          aliases: ["sop sumsum"],
          fields: [{ key: "proses", body: "Kuah dimasak 6 jam dengan rempah." }],
        }),
        listProductKnowledge: async () => [],
        getClaimWords: async () => ({ industry: "fnb", claim_words: FNB }),
      },
    );
    const without = res.findings.filter((f) => f.status === "tanpa_sumber").map((f) => f.claim);
    expect(without).toEqual(expect.arrayContaining(["kambing muda", "2-3 orang"]));
    expect(res.findings.find((f) => f.claim === "6 jam")?.status).toBe("ada_sumber");
    expect(res.note).toMatch(/Product Knowledge kosong/);
    expect(res.findings[0]!.status).toBe("tanpa_sumber");
  });
});

describe("claim check across industries", () => {
  it("food words are not claims for another industry; universal patterns still are", () => {
    const universal = claimWordMatcher();
    expect(claimsIn("Kemeja biru muda, garansi 1 tahun, paling laris.", universal)).toEqual(
      expect.arrayContaining(["1 tahun", "garansi", "paling laris"]),
    );
    expect(claimsIn("Kemeja biru muda.", universal)).toEqual([]);
  });

  it("electronics and beauty claims come from their template words", () => {
    const electronics = claimWordMatcher(["fast charging", "garansi resmi", "anti air"]);
    expect(claimsIn("Baterai 5000 mAh, fast charging, garansi resmi 1 tahun.", electronics)).toEqual(
      expect.arrayContaining(["5000 mah", "fast charging", "garansi resmi", "1 tahun"]),
    );
    const beauty = claimWordMatcher(["glowing", "bpom", "memutihkan"]);
    expect(claimsIn("Glowing dalam 7 hari, sudah BPOM dan aman.", beauty)).toEqual(
      expect.arrayContaining(["glowing", "7 hari", "bpom", "aman"]),
    );
  });

  it("reads an organization's own claim words from Gaya baku", () => {
    expect(gayaClaimWords({ aturan: "- Kata klaim: kambing etawa, susu murni; resep nenek\n- lain" })).toEqual([
      "kambing etawa",
      "susu murni",
      "resep nenek",
    ]);
  });
});
