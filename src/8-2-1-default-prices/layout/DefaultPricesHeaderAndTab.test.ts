import { describe, expect, it } from "vitest";
import {
  catalogTabFromPathname,
  catalogTabPath,
  LIBRARY_BRANDS_PATH,
  LIBRARY_BUNDLES_PATH,
  LIBRARY_CATEGORIES_PATH,
  LIBRARY_DISCOUNTS_PATH,
  LIBRARY_GRATUITY_PATH,
  LIBRARY_MODIFIERS_PATH,
  LIBRARY_PRODUCTS_PATH,
  LIBRARY_PROMOS_PATH,
  LIBRARY_SALES_TYPES_PATH,
  LIBRARY_SERVICES_PATH,
  LIBRARY_TAXES_PATH,
} from "./DefaultPricesHeaderAndTab";

describe("catalogTabFromPathname", () => {
  it("maps library pathnames to the matching panel", () => {
    expect(catalogTabFromPathname(LIBRARY_PRODUCTS_PATH)).toBe("products");
    expect(catalogTabFromPathname(`${LIBRARY_PRODUCTS_PATH}/`)).toBe("products");
    expect(catalogTabFromPathname(LIBRARY_SERVICES_PATH)).toBe("services");
    expect(catalogTabFromPathname(LIBRARY_BUNDLES_PATH)).toBe("bundles");
    expect(catalogTabFromPathname(LIBRARY_CATEGORIES_PATH)).toBe("categories");
    expect(catalogTabFromPathname(LIBRARY_BRANDS_PATH)).toBe("brands");
    expect(catalogTabFromPathname(LIBRARY_MODIFIERS_PATH)).toBe("modifiers");
    expect(catalogTabFromPathname(LIBRARY_GRATUITY_PATH)).toBe("gratuity");
    expect(catalogTabFromPathname(LIBRARY_DISCOUNTS_PATH)).toBe("discounts");
    expect(catalogTabFromPathname(LIBRARY_PROMOS_PATH)).toBe("promos");
    expect(catalogTabFromPathname(LIBRARY_SALES_TYPES_PATH)).toBe("sales-types");
    expect(catalogTabFromPathname(LIBRARY_TAXES_PATH)).toBe("taxes");
    expect(catalogTabFromPathname("/operations/library")).toBe("services");
  });
});

describe("catalogTabPath", () => {
  it("returns library pathnames, not query tabs", () => {
    expect(catalogTabPath("services")).toBe(LIBRARY_SERVICES_PATH);
    expect(catalogTabPath("products")).toBe(LIBRARY_PRODUCTS_PATH);
    expect(catalogTabPath("bundles")).toBe(LIBRARY_BUNDLES_PATH);
    expect(catalogTabPath("categories")).toBe(LIBRARY_CATEGORIES_PATH);
    expect(catalogTabPath("brands")).toBe(LIBRARY_BRANDS_PATH);
    expect(catalogTabPath("modifiers")).toBe(LIBRARY_MODIFIERS_PATH);
    expect(catalogTabPath("gratuity")).toBe(LIBRARY_GRATUITY_PATH);
    expect(catalogTabPath("discounts")).toBe(LIBRARY_DISCOUNTS_PATH);
    expect(catalogTabPath("promos")).toBe(LIBRARY_PROMOS_PATH);
    expect(catalogTabPath("sales-types")).toBe(LIBRARY_SALES_TYPES_PATH);
    expect(catalogTabPath("taxes")).toBe(LIBRARY_TAXES_PATH);
  });
});
