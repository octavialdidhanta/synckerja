import { describe, expect, it } from "vitest";
import {
  parseCategoryLayout,
  resolveCategorySection,
  sliderPresentation,
} from "./orderCategoryLayout";

describe("parseCategoryLayout", () => {
  it("defaults unknown and missing values to list", () => {
    expect(parseCategoryLayout(undefined)).toBe("list");
    expect(parseCategoryLayout(null)).toBe("list");
    expect(parseCategoryLayout("grid")).toBe("list");
    expect(parseCategoryLayout("list")).toBe("list");
    expect(parseCategoryLayout("slider_bleed")).toBe("slider_bleed");
  });

  it("parses grid_2col", () => {
    expect(parseCategoryLayout("grid_2col")).toBe("grid_2col");
  });
});

describe("sliderPresentation", () => {
  it("hides empty slider sections", () => {
    expect(sliderPresentation(0)).toBe("hidden");
  });

  it("keeps a single item contained on the left", () => {
    expect(sliderPresentation(1)).toBe("contained");
  });

  it("uses full-bleed peek for two or more items", () => {
    expect(sliderPresentation(2)).toBe("bleed");
    expect(sliderPresentation(8)).toBe("bleed");
  });
});

describe("resolveCategorySection", () => {
  it("never bleeds a list section", () => {
    expect(resolveCategorySection({ layout: "list", itemCount: 5 })).toEqual({
      layout: "list",
      presentation: "list",
      slider: "hidden",
    });
  });

  it("falls a one-item slider back to contained", () => {
    expect(resolveCategorySection({ layout: "slider_bleed", itemCount: 1 })).toEqual({
      layout: "slider_bleed",
      presentation: "slider",
      slider: "contained",
    });
  });

  it("resolves grid_2col to grid presentation", () => {
    expect(resolveCategorySection({ layout: "grid_2col", itemCount: 3 })).toEqual({
      layout: "grid_2col",
      presentation: "grid",
      slider: "hidden",
    });
  });
});
