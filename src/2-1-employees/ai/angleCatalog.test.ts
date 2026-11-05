import { describe, expect, it } from "vitest";
import { anglesForCatalogs, anglesWithLockedIdeas, pillarsForLockedIdeas } from "./angleCatalog";

const options = [
  { id: "a", serviceId: "synckerja" },
  { id: "b", serviceId: "etix" },
  { id: "c", serviceId: null },
];

describe("anglesForCatalogs", () => {
  it("keeps every angle when the brief has no catalog", () => {
    expect(anglesForCatalogs(options, [])).toEqual(options);
  });

  it("keeps only angles whose master catalog is selected", () => {
    expect(anglesForCatalogs(options, ["synckerja"]).map((row) => row.id)).toEqual(["a"]);
  });

  it("hides an angle whose master has no catalog once a catalog is selected", () => {
    expect(anglesForCatalogs(options, ["etix"]).map((row) => row.id)).toEqual(["b"]);
  });

  it("accepts more than one selected catalog", () => {
    expect(anglesForCatalogs(options, ["synckerja", "etix"]).map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("anglesWithLockedIdeas", () => {
  it("keeps only angles that already have a locked idea", () => {
    const rows = [
      { id: "locked", ideas: [{ id: "idea" }] },
      { id: "empty", ideas: [] },
    ];
    expect(anglesWithLockedIdeas(rows).map((row) => row.id)).toEqual(["locked"]);
  });
});

describe("pillarsForLockedIdeas", () => {
  const pillars = [
    { id: "edukasi" },
    { id: "cerita" },
    { id: "penawaran" },
  ];
  const angles = [
    { id: "an02", serviceId: "openbook", ideas: [{ id: "idea" }], pillarIds: ["edukasi"] },
    { id: "an03", serviceId: "openbook", ideas: [{ id: "idea-2" }], pillarIds: ["cerita"] },
    { id: "an04", serviceId: "synckerja", ideas: [{ id: "idea-3" }], pillarIds: ["penawaran"] },
    { id: "plain", serviceId: "openbook", ideas: [], pillarIds: [] },
  ];

  it("shows only pillars locked on the selected angles", () => {
    expect(pillarsForLockedIdeas(pillars, angles, ["an02"]).map((row) => row.id)).toEqual(["edukasi"]);
  });

  it("shows nothing until an angle is selected", () => {
    expect(pillarsForLockedIdeas(pillars, angles, [])).toEqual([]);
  });
});
