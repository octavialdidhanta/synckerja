import { describe, expect, it } from "vitest";
import { parseAdvantagePoints, pointHash, pointRef } from "./advantagePoints";

describe("parseAdvantagePoints", () => {
  it("reads list items from HTML", () => {
    expect(parseAdvantagePoints("<ol><li>Garansi rasa, <b>pasti</b> empuk</li><li>Dimasak 8 jam</li></ol>")).toEqual([
      "Garansi rasa, pasti empuk",
      "Dimasak 8 jam",
    ]);
  });
  it("reads arrays and paragraphs and drops duplicates", () => {
    expect(parseAdvantagePoints(["Bebas prengus", "<p>Halal</p><p>Bebas prengus</p>"])).toEqual(["Bebas prengus", "Halal"]);
  });
  it("splits plain text lines and strips bullets", () => {
    expect(parseAdvantagePoints("- Porsi besar\n2. Dekat DBS &amp; parkir")).toEqual(["Porsi besar", "Dekat DBS & parkir"]);
  });
  it("returns nothing for empty values", () => {
    expect(parseAdvantagePoints(null)).toEqual([]);
    expect(parseAdvantagePoints("<p></p>")).toEqual([]);
  });
  it("hashes ignoring case and outer spaces", () => {
    expect(pointHash(" Halal ")).toBe(pointHash("halal"));
    expect(pointRef("pk1", "Halal")).toMatch(/^pk1:[0-9a-f]{8}$/);
  });
});
