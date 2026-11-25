import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MENU_FIELDS } from "./libraryData";
import {
  FALLBACK_MENU_FIELDS,
  buildDescribePrompt,
  draftLanguage,
  geminiModel,
  parseDraftFields,
  pickPhoto,
  templateFields,
} from "../../../supabase/functions/_shared/describeCatalogProduct";

describe("catalog photo draft", () => {
  it("uses the same columns as the product form when the organization has no template", () => {
    expect(FALLBACK_MENU_FIELDS.map((field) => [field.key, field.label])).toEqual(MENU_FIELDS);
    expect(templateFields([])).toEqual(FALLBACK_MENU_FIELDS);
    expect(templateFields([{ key: "screen", label: "Layar", position: 2 }, { key: "main", label: "Apa yang ditawarkan", position: 1 }]).map((field) => field.key)).toEqual(["main", "screen"]);
  });

  it("reads the reference photo before the Item Library photo", () => {
    expect(pickPhoto(["", "org/photo.jpg"], "org/item.jpg")).toEqual({ bucket: "catalog-media", path: "org/photo.jpg" });
    expect(pickPhoto([null], "org/item.jpg")).toEqual({ bucket: "catalog-product-photos", path: "org/item.jpg" });
    expect(pickPhoto([], null, "org/test1.png")).toEqual({ bucket: "sub-service-photos", path: "org/test1.png" });
    expect(pickPhoto([], "  ")).toBeNull();
  });

  it("keeps a Gemini model id and replaces any other provider", () => {
    expect(geminiModel("gemini-2.5-flash")).toBe("gemini-2.5-flash");
    expect(geminiModel("llama-3.3-70b-versatile")).toBe("gemini-2.5-flash");
    expect(geminiModel("")).toBe("gemini-2.5-flash");
  });

  it("follows the language already on the product", () => {
    expect(draftLanguage([])).toBe("id");
    expect(draftLanguage(["The meat is grilled and the bone is visible."])).toBe("en");
    expect(draftLanguage(["Daging bakar dengan tulang yang terlihat."])).toBe("id");
  });

  it("drops unknown keys, empty text, and anything past the column limit", () => {
    const parsed = parseDraftFields(
      'prefix {"fields":{"main":"  Mangkuk sop  ","price":"Rp10","sauce":"","topping":"' + "a".repeat(4001) + '"}}',
      ["main", "topping", "sauce"],
    );
    expect(parsed.main).toBe("Mangkuk sop");
    expect(parsed.price).toBeUndefined();
    expect(parsed.sauce).toBeUndefined();
    expect(parsed.topping).toHaveLength(4000);
    expect(parseDraftFields("not json", ["main"])).toEqual({});
  });

  it("tells the model to stay with what the photo shows", () => {
    const prompt = buildDescribePrompt({
      name: "Sup Sum Sum Kambing",
      fields: FALLBACK_MENU_FIELDS,
      language: "id",
    });
    expect(prompt).toContain("Do not invent a price");
    expect(prompt).toContain("Bahasa Indonesia");
    expect(prompt).toContain("main: Hidangan utama");
  });

  it("does not write catalog rows from the edge function", () => {
    const source = readFileSync(resolve("supabase/functions/describe-catalog-product/index.ts"), "utf8");
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    expect(source).not.toContain("ANTHROPIC");
  });
});
