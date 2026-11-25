import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDraftFields } from "../../../supabase/functions/_shared/describeCatalogProduct";
import {
  LOCATION_ALWAYS_ON,
  LOCATION_DRAFT_FIELDS,
  buildLocationDescribePrompt,
} from "../../../supabase/functions/_shared/describeCatalogLocation";

describe("location photo draft", () => {
  it("asks only for the place, in the language already used", () => {
    const prompt = buildLocationDescribePrompt({ name: "Samping kiri", photoLabel: "Teras", language: "id" });
    expect(prompt).toContain("Location: Samping kiri");
    expect(prompt).toContain("Photo: Teras");
    expect(prompt).toContain("Do not invent a price");
    expect(prompt).toContain("Bahasa Indonesia");
    for (const field of LOCATION_DRAFT_FIELDS) expect(prompt).toContain(`${field.key}:`);
    expect(buildLocationDescribePrompt({ name: "Side", photoLabel: "Terrace", language: "en" })).toContain("English");
  });

  it("keeps the Flow section titles", () => {
    expect(LOCATION_ALWAYS_ON.map((section) => section.title)).toEqual(["Scene", "Atmosphere", "Must NOT"]);
  });

  it("drops a product column and keeps the location fields", () => {
    const parsed = parseDraftFields(
      '{"fields":{"desc":"  Teras kiri  ","main":"iga bakar","scene":"Pagi","must_not":""}}',
      LOCATION_DRAFT_FIELDS.map((field) => field.key),
    );
    expect(parsed).toEqual({ desc: "Teras kiri", scene: "Pagi" });
  });

  it("reads the location photo from catalog-media and does not write a row", () => {
    const source = readFileSync(resolve("supabase/functions/describe-catalog-location/index.ts"), "utf8");
    expect(source).toContain('.from("catalog-media")');
    expect(source).not.toMatch(/default_prices|sub_services|catalog-product-photos|sub-service-photos/);
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });
});
