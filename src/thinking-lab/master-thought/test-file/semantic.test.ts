import { describe, expect, it, vi } from "vitest";
import {
  beliefClaim,
  buildBeliefOptionsPrompt,
  collectBeliefOptions,
  confirmedBeliefFacts,
  confirmedFingerprint,
  confirmedParentReady,
  filterBeliefCandidates,
  normalizeMasterThoughtFacts,
} from "@/thinking-lab/master-thought/semantic";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];
const prior = "Bawa bekel ke kantor jauh lebih hemat";
const planted = "Makan di luar lebih hemat dari bawa bekel setiap hari";
const catalog = { category: "Katering Kantor", subCategories: ["Paket Makan Siang"], features: [] };

describe("master thought stored facts", () => {
  it("saves the belief as its own subject", () => {
    expect(confirmedBeliefFacts("  makan di luar   lebih hemat ")).toEqual({
      subject: "Makan di luar lebih hemat",
      beliefOptions: [],
    });
  });

  it("reads older rows and keeps only the subject and waiting options", () => {
    expect(
      normalizeMasterThoughtFacts({
        outcome: "PROPOSAL_RECOMMENDED",
        subject: "makan di luar lebih hemat",
        proposedRootBelief: "Something else",
        resolution: "RESOLVED",
        beliefOptions: [{ belief: "Satu", description: "a" }, "Dua", { text: "Tiga" }, "Empat"],
      }),
    ).toEqual({
      subject: "Makan di luar lebih hemat",
      beliefOptions: [
        { belief: "Satu", description: "a" },
        { belief: "Dua", description: "" },
        { belief: "Tiga", description: "" },
      ],
    });
    expect(normalizeMasterThoughtFacts(null)).toBeNull();
    expect(normalizeMasterThoughtFacts({ beliefOptions: null })).toEqual({ subject: null, beliefOptions: [] });
  });

  it("treats a saved belief as ready only while its fingerprint matches", () => {
    const fingerprint = confirmedFingerprint(planted, planted);
    expect(
      confirmedParentReady({ confirmationSource: "original", statement: planted, rootBelief: planted, semanticFingerprint: fingerprint }),
    ).toBe(true);
    expect(
      confirmedParentReady({ confirmationSource: null, statement: planted, rootBelief: planted, semanticFingerprint: fingerprint }),
    ).toBe(false);
    expect(
      confirmedParentReady({ confirmationSource: "original", statement: "Changed", rootBelief: planted, semanticFingerprint: fingerprint }),
    ).toBe(false);
  });
});

describe("master thought belief options", () => {
  it("ignores a leading Ternyata when comparing claims", () => {
    expect(beliefClaim("Ternyata makan di luar lebih hemat dari bawa bekel setiap hari")).toBe(
      "makan di luar lebih hemat dari bawa bekel setiap hari",
    );
  });

  it("drops reasons, titles, the old belief, and duplicates", () => {
    expect(
      filterBeliefCandidates(
        [
          planted,
          "karena bahan dibeli sekaligus",
          "Kemampuan makan di luar",
          `Ternyata ${prior}`,
          planted,
          "ternyata makan di luar lebih hemat dari bawa bekel setiap hari",
          "Ibu saya adalah orang paling baik sedunia",
          "",
        ],
        prior,
      ),
    ).toEqual([
      { belief: planted, description: "" },
      { belief: "Ibu saya adalah orang paling baik sedunia", description: "" },
    ]);
  });

  it("asks for beliefs that already meet every Master Thought rule, with no industry example", () => {
    const prompt = buildBeliefOptionsPrompt({ planted, priorBelief: prior, audience: "orang kantoran", catalog });
    expect(prompt).toContain("Every belief must meet each of these rules:");
    expect(prompt).toContain("tepat satu klaim");
    expect(prompt).toContain("nama merek, toko, atau penyedia");
    expect(prompt).toContain("Ternyata is optional");
    expect(prompt).toContain("Stay inside the shift");
    expect(prompt).toContain(planted);
    expect(prompt).toContain(prior);
    expect(prompt).toContain("Paket Makan Siang");
    for (const word of BANNED) expect(prompt.toLowerCase()).not.toContain(word);
  });

  it("keeps only the options that pass the same checks as a typed belief", async () => {
    const draft = vi.fn(async () =>
      JSON.stringify({
        beliefs: [
          { belief: planted, description: "Sama dengan yang ditulis." },
          { belief: "Makan di luar lebih hemat daripada bawa bekel tiap hari", description: "Lolos." },
          { belief: "Katering Warung Contoh paling hemat", description: "Menyebut merek." },
          { belief: "karena bahan lebih murah", description: "Ini alasan." },
        ],
      }),
    );
    const judge = vi.fn(async (prompt: string) => {
      const brand = prompt.includes("Warung Contoh");
      return JSON.stringify({
        checks: ["singleClaim", "noPromoOrBrand", "subjectClear", "shift", "accountable"].map((id) => ({
          id,
          pass: !(brand && id === "noPromoOrBrand"),
          reason: brand && id === "noPromoOrBrand" ? "Menyebut merek." : "",
        })),
      });
    });
    const options = await collectBeliefOptions({ planted, priorBelief: prior, catalog }, draft, judge);
    expect(options).toEqual([{ belief: "Makan di luar lebih hemat daripada bawa bekel tiap hari", description: "Lolos." }]);
    expect(draft).toHaveBeenCalledTimes(1);
    expect(judge).toHaveBeenCalledTimes(2);
  });

  it("follows the switches: with every check OFF, no option is judged", async () => {
    const draft = vi.fn(async () => JSON.stringify({ beliefs: [{ belief: "Makan di luar lebih hemat tiap hari", description: "" }] }));
    const judge = vi.fn(async () => null);
    const options = await collectBeliefOptions(
      {
        planted,
        priorBelief: prior,
        catalog,
        skip: ["singleClaim", "noPromoOrBrand", "subjectClear", "shift", "accountable"],
      },
      draft,
      judge,
    );
    expect(options).toHaveLength(1);
    expect(judge).not.toHaveBeenCalled();
  });
});
