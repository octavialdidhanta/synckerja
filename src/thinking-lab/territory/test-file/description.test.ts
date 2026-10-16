import { describe, expect, it } from "vitest";
import {
  buildTerritoryLivedPrompt,
  parseTerritoryLived,
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
    expect(copy.area).toBe("Orang sedang tidak ingin repot, jadi pilihan yang paling sedikit usaha langsung terpakai.");
    expect(copy.area).not.toContain("Kemudahan untuk memperoleh sesuatu");
  });

  it("does not paste the shared Big Thought under a Territory name", () => {
    const copy = territoryDescriptions("Jalan pintas", parent, parent);
    expect(copy.area).toBe("");
    expect(territorySceneIsSpecific("Godaan di depan mata", "Godaan di depan mata", parent)).toBe(false);
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
    expect(copy.area).toBe("Shoppers are already in the aisle and grab whatever is closest.");
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
    expect(prompt).toContain("orang yang belanja online");
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
    expect(lived).toBe("Sesuatu sudah ada di depan mata, jadi tangan bergerak sebelum orang memikirkan apa yang mereka inginkan.");
  });
});
