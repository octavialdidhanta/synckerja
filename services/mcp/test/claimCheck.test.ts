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
    expect(claimsIn("(suara asli)")).toEqual([]);
    expect(claimsIn("Pakai suara asli talent [musik masuk 100% di sini]")).toEqual([]);
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
    const without = res.findings.filter((f) => f.status === "tidak_terdaftar").map((f) => f.claim);
    expect(without).toEqual(expect.arrayContaining(["kambing muda", "2-3 orang"]));
    expect(res.findings.find((f) => f.claim === "6 jam")?.status).toBe("sumber_katalog");
    expect(res.note).toMatch(/Product Knowledge kosong/);
    expect(res.findings[0]!.status).toBe("tidak_terdaftar");
  });
});

describe("claim check against the Daftar Klaim", () => {
  const registry = {
    claims: [
      {
        code: "KL01",
        text: "Satu porsi Sup Sum Sum Kambing cukup untuk 2 orang",
        status: "approved" as const,
        scopes: [{ scope: "product" as const, product: "sup-sumsum-kambing", product_name: "Sup Sum Sum Kambing" }],
      },
      { code: "KL02", text: "Lokasi kami di PIK, di gate sebelah Bank DBS", status: "approved" as const, scopes: [{ scope: "location" as const, location: "pik1" }] },
      { code: "KL03", text: "Dimasak 8 jam", status: "needs_proof" as const, scopes: [{ scope: "brand" as const }] },
      { code: "KL04", text: "Daging kambing muda", status: "rejected" as const, scopes: [{ scope: "brand" as const }] },
    ],
  };
  const products = [
    { id: "sup-sumsum-kambing", name: "Sup Sum Sum Kambing", aliases: ["sop sumsum"] },
    { id: "sate-kambing", name: "Sate Kambing", aliases: [] },
  ];
  const deps = {
    listCatalogClaims: async () => registry,
    listCatalogProducts: async () => ({ products }),
    getCatalogProduct: async (_c: unknown, a: { id?: string }) => ({
      name: products.find((p) => p.id === a.id)!.name,
      aliases: [],
      fields: [{ key: "porsi", body: "Porsi sate 10 tusuk." }],
    }),
    listProductKnowledge: async () => [],
    getClaimWords: async () => ({ industry: "fnb", claim_words: FNB }),
  };

  it("labels each claim terdaftar, perlu bukti, ditolak, katalog or not registered and lists the codes used", async () => {
    const res = await checkBriefClaims(
      ctx,
      briefTextParts({
        rows: [
          { vo: "Sop sumsum ini cukup untuk 2 orang, dimasak 8 jam." },
          { element: "Kambing muda, 10 tusuk, 2-3 orang" },
        ],
      }),
      deps,
    );
    const by = Object.fromEntries(res.findings.map((f) => [f.claim, f]));
    expect(by["2 orang"]).toMatchObject({ status: "terdaftar", code: "KL01" });
    expect(by["8 jam"]).toMatchObject({ status: "perlu_bukti", code: "KL03" });
    expect(by["kambing muda"]).toMatchObject({ status: "ditolak", code: "KL04" });
    expect(by["10 tusuk"]).toMatchObject({ status: "sumber_katalog", code: null });
    expect(by["2-3 orang"]).toMatchObject({ status: "tidak_terdaftar" });
    expect(res.codes_used).toEqual(["KL01", "KL03"]);
    expect(res.without_source).toBe(2);
    expect(res.findings[0]!.status).toBe("ditolak");
  });

  it("does not let a product claim back another product's text", async () => {
    const res = await checkBriefClaims(ctx, briefTextParts({ rows: [{ vo: "Sate kambing cukup untuk 2 orang." }] }), deps);
    const f = res.findings.find((x) => x.claim === "2 orang")!;
    expect(f.status).toBe("tidak_terdaftar");
    expect(f.other_scope).toMatch(/^KL01 \(Sup Sum Sum Kambing\)/);
  });

  it("still checks the catalog when the Daftar Klaim cannot be read", async () => {
    const res = await checkBriefClaims(ctx, briefTextParts({ rows: [{ vo: "Isi 10 tusuk." }] }), {
      ...deps,
      listCatalogClaims: async () => {
        throw new Error("boom");
      },
    });
    expect(res.findings[0]).toMatchObject({ claim: "10 tusuk", status: "sumber_katalog" });
    expect(res.note).toMatch(/Daftar Klaim tidak terbaca/);
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

describe("visual and screen-text claims", () => {
  it("finds what a shot prompt would claim on screen", async () => {
    const { visualClaimsIn, shotlistVisualParts } = await import("../src/tools/content/claimCheck");
    expect(visualClaimsIn("Close up of the bowl, a HALAL logo on the wall, long queue of customers outside")).toEqual(
      expect.arrayContaining(["halal", "antre"]),
    );
    expect(visualClaimsIn("Hands pour the broth into a bowl, steam rising")).toEqual([]);
    const parts = shotlistVisualParts([{ id: "S01", action: "Best seller sign above the counter" }, { id: "S02" }]);
    expect(parts).toEqual([{ where: "shot S01 (visual)", text: "Best seller sign above the counter", visual: true }]);
    const res = await checkBriefClaims(ctx, parts, { listCatalogClaims: async () => ({ claims: [] }) });
    expect(res.findings[0]).toMatchObject({ claim: "best seller", status: "tidak_terdaftar" });
  });

  it("reads hooks and labels one by one and subtitles together", async () => {
    const { renderTextParts } = await import("../src/mcp/handler");
    expect(
      renderTextParts({
        texts: [
          { text: "Paling enak se-PIK", start: 0, style: "hook" },
          { text: "cukup untuk", start: 1, style: "sub" },
          { text: "2 orang", start: 2 },
          { text: " ", style: "menu" },
        ],
      }),
    ).toEqual([
      { where: "teks layar hook 0s", text: "Paling enak se-PIK" },
      { where: "subtitle", text: "cukup untuk\n2 orang" },
    ]);
    expect(renderTextParts(null)).toEqual([]);
  });
});

describe("casual spelling", () => {
  it("matches casual words to the approved claim", async () => {
    const { norm } = await import("../../../src/shared/claims/claimMatch");
    expect(norm("Nggak bau prengus, udah empuk banget")).toBe("tidak bau prengus, sudah empuk sangat");
    expect(norm("Gagal? Tak mungkin")).toBe("gagal? tidak mungkin");
    const res = await checkBriefClaims(
      ctx,
      briefTextParts({ rows: [{ element: "✅ Nggak bau prengus" }, { vo: "Dagingnya gak bau sama sekali, cukup buat 2 org" }] }),
      {
        listCatalogClaims: async () => ({
          claims: [
            { code: "KL03", text: "Daging kambing tidak bau prengus", status: "approved", scopes: [{ scope: "brand" }] },
            { code: "KL01", text: "Satu porsi cukup untuk 2 orang", status: "approved", scopes: [{ scope: "brand" }] },
          ],
        }),
        getClaimWords: async () => ({ industry: "fnb", claim_words: ["nggak bau", "tidak bau", "prengus"] }),
      },
    );
    expect(res.findings.every((f) => f.status === "terdaftar")).toBe(true);
    expect(res.codes_used).toEqual(["KL01", "KL03"]);
  });
});
