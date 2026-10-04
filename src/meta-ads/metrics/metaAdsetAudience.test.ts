import { describe, expect, it } from "vitest";
import {
  metaAdReviewAudience,
  metaAdsetAdvantageAudience,
  metaAdsetAudienceSections,
  metaAudienceSentenceLines,
} from "@/meta-ads/metrics/metaAdsetAudience";

describe("metaAdsetAudienceSections", () => {
  it("reads the audience saved on a Meta ad set", () => {
    const sections = metaAdsetAudienceSections({
      age_min: 18,
      age_max: 65,
      geo_locations: { countries: ["ID"], cities: [{ name: "Jakarta", radius: 25, distance_unit: "kilometer" }] },
      flexible_spec: [{ interests: [{ id: "1", name: "iPhone" }] }],
      publisher_platforms: ["instagram", "threads"],
      instagram_positions: ["stream", "story"],
      targeting_automation: { advantage_audience: 0 },
    });

    expect(sections.find((section) => section.key === "locations")?.values).toEqual([
      "ID",
      "Jakarta (+25 km)",
    ]);
    expect(sections.find((section) => section.key === "age")?.values).toEqual(["18–65+"]);
    expect(sections.find((section) => section.key === "gender")?.values).toEqual(["All"]);
    expect(sections.find((section) => section.key === "detailedTargeting")?.values).toEqual([
      "Interests: iPhone",
    ]);
    expect(sections.find((section) => section.key === "placements")?.values).toEqual([
      "Instagram",
      "Threads",
      "stream",
      "story",
    ]);
    expect(metaAdsetAdvantageAudience({ targeting_automation: { advantage_audience: 1 } })).toBe(true);
  });

  it("keeps Meta sentence lines as written", () => {
    expect(
      metaAudienceSentenceLines([
        { content: "Location:", children: ["Indonesia"] },
        { content: "People who match:", children: ["Interests: iPhone"] },
      ]),
    ).toEqual([
      { label: "Location", values: ["Indonesia"] },
      { label: "People who match", values: ["Interests: iPhone"] },
    ]);
  });

  it("keeps only custom audience or people who match, location, and age for an ad review", () => {
    const blocks = metaAdReviewAudience({
      targeting: null,
      sentenceLines: [
        { content: "Location:", children: ["Indonesia"] },
        { content: "Age:", children: ["18 - 65"] },
        { content: "Language:", children: ["Indonesian"] },
        { content: "Placements:", children: ["Instagram", "Threads"] },
        { content: "People who match:", children: ["Interests: iPhone"] },
        { content: "Custom audiences:", children: ["Buyers 90 days"] },
      ],
    });

    expect(blocks.map((block) => block.key)).toEqual(["custom", "match", "location", "age"]);
    expect(blocks.find((block) => block.key === "match")?.values).toEqual(["Interests: iPhone"]);
  });
});
