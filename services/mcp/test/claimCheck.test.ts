import { describe, expect, it } from "vitest";
import { briefTextParts, checkBriefClaims, claimsIn, supported } from "../src/tools/content/claimCheck";

const ctx = { userId: "u", organizationId: "o" } as never;

describe("claim check", () => {
  it("finds number, price and quality claims, not calls to action", () => {
    expect(claimsIn("Kambing muda, empuk, cukup buat 2–3 orang.")).toEqual(expect.arrayContaining(["kambing muda", "empuk", "2-3 orang"]));
    expect(claimsIn("Dimasak 6 jam, harganya cuma 35 ribu!")).toEqual(expect.arrayContaining(["6 jam", "35 ribu"]));
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
      },
    );
    const without = res.findings.filter((f) => f.status === "tanpa_sumber").map((f) => f.claim);
    expect(without).toEqual(expect.arrayContaining(["kambing muda", "2-3 orang"]));
    expect(res.findings.find((f) => f.claim === "6 jam")?.status).toBe("ada_sumber");
    expect(res.note).toMatch(/Product Knowledge kosong/);
    expect(res.findings[0]!.status).toBe("tanpa_sumber");
  });
});
