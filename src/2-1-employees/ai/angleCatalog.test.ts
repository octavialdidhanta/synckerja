import { describe, expect, it } from "vitest";
import {
  anglesForCatalogs,
  anglesWithLockedIdeas,
  groupBriefPillars,
  MAX_BRIEF_PILLARS,
  pillarsForLockedIdeas,
  clampBriefPillarIds,
  syncPillarIdsForAngles,
} from "./angleCatalog";

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

describe("syncPillarIdsForAngles", () => {
  const angles = [
    { id: "an02", pillarIds: ["edukasi", "shared"] },
    { id: "an03", pillarIds: ["cerita", "shared"] },
    { id: "an04", pillarIds: ["penawaran"] },
  ];

  it("clears all pillars when no angle is selected", () => {
    expect(syncPillarIdsForAngles(angles, [])).toEqual([]);
  });

  it("fills locked pillars for one selected angle", () => {
    expect(syncPillarIdsForAngles(angles, ["an02"])).toEqual(["edukasi", "shared"]);
  });

  it("unions locked pillars across angles in selection order and dedupes", () => {
    expect(syncPillarIdsForAngles(angles, ["an03", "an02"])).toEqual(["cerita", "shared", "edukasi"]);
  });

  it("caps at MAX_BRIEF_PILLARS", () => {
    const many = {
      id: "wide",
      pillarIds: Array.from({ length: MAX_BRIEF_PILLARS + 5 }, (_, i) => `p${i}`),
    };
    expect(syncPillarIdsForAngles([many], ["wide"])).toEqual(
      Array.from({ length: MAX_BRIEF_PILLARS }, (_, i) => `p${i}`),
    );
  });
});

describe("clampBriefPillarIds", () => {
  it("clears all pillars when no angle is selected", () => {
    expect(clampBriefPillarIds(["edukasi", "cerita"], [])).toEqual([]);
  });

  it("keeps pillars while at least one angle is selected", () => {
    expect(clampBriefPillarIds(["edukasi", "orphan"], ["an02"])).toEqual(["edukasi", "orphan"]);
  });
});

describe("groupBriefPillars", () => {
  const pillars = [
    { id: "green", label: "Green Flags" },
    { id: "audit", label: "Audit Akun Publik" },
    { id: "edu", label: "Edukasi" },
    { id: "behind", label: "Behind The Scene" },
    { id: "promo", label: "Promo" },
  ];

  it("splits locked, used this month, and unused pillars, least used first", () => {
    const groups = groupBriefPillars(pillars, new Set(["green", "audit"]), {
      green: { count: 2 },
      audit: { count: 0 },
      edu: { count: 3 },
      promo: { count: 1 },
    });
    expect(groups.locked.map((row) => row.id)).toEqual(["audit", "green"]);
    expect(groups.used.map((row) => row.id)).toEqual(["promo", "edu"]);
    expect(groups.unused.map((row) => row.id)).toEqual(["behind"]);
  });

  it("puts everything under unused when nothing is locked or used", () => {
    const groups = groupBriefPillars(pillars, new Set());
    expect(groups.locked).toEqual([]);
    expect(groups.used).toEqual([]);
    expect(groups.unused.map((row) => row.id)).toEqual(["audit", "behind", "edu", "green", "promo"]);
  });
});
