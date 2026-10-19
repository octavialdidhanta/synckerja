import { describe, expect, it } from "vitest";
import {
  buildTerritoryLivedPrompt,
  parseTerritoryLived,
  parseTerritoryQuestion,
  territoryDescriptions,
  territorySceneIsSpecific,
} from "@/thinking-lab/territory/description";

const parent = "Kemudahan untuk memperoleh sesuatu sering kali lebih menentukan daripada keinginan untuk memilikinya.";

describe("territory descriptions", () => {
  it("shows a sentence that belongs to this Territory", () => {
    const copy = territoryDescriptions(
      "Momen mager",
      "Orang sedang tidak ingin repot, jadi pilihan yang paling sedikit usaha langsung terpakai.",
      parent,
    );
    expect(copy.areaLead).toBe("");
    expect(copy.area).toBe(
      "Di wilayah ini, orang sedang tidak ingin repot, jadi pilihan yang paling sedikit usaha langsung terpakai.",
    );
    expect(copy.area).not.toContain("Kemudahan untuk memperoleh sesuatu");
    expect(copy.area).not.toContain("Momen mager");
  });

  it("does not paste the shared Big Thought under a Territory name", () => {
    const copy = territoryDescriptions("Jalan pintas", parent, parent);
    expect(copy.area).toBe("");
    expect(territorySceneIsSpecific("Godaan di depan mata", "Godaan di depan mata", parent)).toBe(false);
  });

  it("keeps a sentence that mentions the Territory while saying what happens there", () => {
    const copy = territoryDescriptions(
      "Riset pasar",
      "Riset pasar membuat orang membandingkan harga sebelum membeli.",
      parent,
    );
    expect(copy.area).toBe("Di wilayah ini, riset pasar membuat orang membandingkan harga sebelum membeli.");
  });

  it("rejects the old frame that only wraps the Territory name", () => {
    expect(
      territorySceneIsSpecific(
        "Momen mager",
        "Di Momen mager, ini yang orang hadapi: orang malas bergerak.",
        parent,
      ),
    ).toBe(false);
  });

  it("uses an English lived sentence without the old frame", () => {
    const copy = territoryDescriptions(
      "monthly market run",
      "Shoppers are already in the aisle and grab whatever is closest.",
      "prices rise faster than wages",
    );
    expect(copy.area).toBe("In this area, shoppers are already in the aisle and grab whatever is closest.");
  });

  it("asks for a situation that cannot be reused by a sibling Territory", () => {
    const prompt = buildTerritoryLivedPrompt({
      territory: "Momen mager",
      parentStatement: parent,
      audience: "orang yang belanja online",
    });
    expect(prompt).toContain("Momen mager");
    expect(prompt).toContain("Do not quote");
    expect(prompt).toContain("Indonesian");
    expect(prompt).toContain('Start the sentence with "Di wilayah ini,"');
    expect(prompt).toContain("orang yang belanja online");
    expect(prompt).toContain("The answer to that question is the Big Thought");
    expect(prompt).toContain('{"lived":"...","question":"...?"}');
  });

  it("asks for a question the Big Thought answers, not one the Master Thought already settles", () => {
    const prompt = buildTerritoryLivedPrompt({
      territory: "Makan siang kantor",
      parentStatement: parent,
      masterStatement: "Makan di luar hemat dan menawarkan lauk yang lebih variatif.",
      siblings: ["Pilihan makan"],
    });
    expect(prompt).toContain("Makan di luar hemat dan menawarkan lauk yang lebih variatif.");
    expect(prompt).toContain("yes-or-no question the Master Thought already settles");
    expect(prompt).toContain("Pilihan makan");
  });

  it("drops a model answer that copies the Big Thought", () => {
    const lived = parseTerritoryLived(`{"lived":"${parent}"}`, {
      territory: "Jalan pintas",
      parentStatement: parent,
    });
    expect(lived).toBe("");
  });

  it("keeps one specific sentence from the model", () => {
    const lived = parseTerritoryLived(
      '{"lived":"Sesuatu sudah ada di depan mata, jadi tangan bergerak sebelum orang memikirkan apa yang mereka inginkan."}',
      { territory: "Godaan di depan mata", parentStatement: parent },
    );
    expect(lived).toBe(
      "Di wilayah ini, sesuatu sudah ada di depan mata, jadi tangan bergerak sebelum orang memikirkan apa yang mereka inginkan.",
    );
  });

  it("keeps the question whose answer is the Big Thought", () => {
    const script =
      '{"lived":"Waktu makan siang tinggal sebentar, jadi orang menimbang bekal dan makanan dari luar.","question":"kenapa makanan dari luar bisa lebih hemat daripada bekal untuk satu porsi?"}';
    expect(parseTerritoryQuestion(script, { territory: "Makan siang kantor", parentStatement: parent })).toBe(
      "Kenapa makanan dari luar bisa lebih hemat daripada bekal untuk satu porsi?",
    );
  });

  it("drops a question that copies the Big Thought or asks what the Master Thought already settles", () => {
    const scope = {
      territory: "Makan siang kantor",
      parentStatement: parent,
      masterStatement: "Makan di luar hemat dan menawarkan lauk yang lebih variatif.",
    };
    expect(parseTerritoryQuestion(`{"question":"${parent}"}`, scope)).toBe("");
    expect(
      parseTerritoryQuestion('{"question":"Apakah makan di luar lebih hemat dan lebih variatif?"}', scope),
    ).toBe("");
  });
});
