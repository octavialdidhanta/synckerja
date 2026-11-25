import { describe, expect, it } from "vitest";
import {
  catalogSlug,
  existingMenuForSource,
  linkedProductName,
  locationDraftError,
  parseAliases,
  productDraftError,
  uniqueCatalogSlug,
  unlinkedSources,
} from "./catalogEdit";

describe("catalog slug", () => {
  it("turns a name into the external id pattern", () => {
    expect(catalogSlug("Powerbank 20000mAh")).toBe("powerbank-20000mah");
    expect(catalogSlug("PIK2")).toBe("pik2");
    expect(catalogSlug("Office Desk")).toBe("office-desk");
    expect(catalogSlug("???")).toBe("");
  });

  it("adds a number when the slug is already used", () => {
    expect(uniqueCatalogSlug("pik2", ["pik1", "pik2"])).toBe("pik2-2");
  });
});

describe("catalog source link", () => {
  const menus = [
    { id: "m1", nama: "Sate Babi", defaultPriceId: null, featureId: null },
    { id: "m2", nama: "Kopi", defaultPriceId: "p1", featureId: null },
  ];

  it("attaches a matching name and skips a source that is already linked", () => {
    expect(existingMenuForSource("sate babi", menus, "item")).toEqual({ menuId: "m1" });
    expect(existingMenuForSource("Teh", menus, "item")).toEqual({ create: true });
    expect(existingMenuForSource("Kopi", menus, "item")).toEqual({ error: "Nama ini sudah tertaut." });
    expect(unlinkedSources([{ id: "p1" }, { id: "p2" }], menus, "item").map((item) => item.id)).toEqual(["p2"]);
  });

  it("shows the live source name when a product is linked", () => {
    expect(linkedProductName(menus[1], [{ id: "p1", name: "Kopi Susu" }])).toBe("Kopi Susu");
    expect(linkedProductName(menus[0], [])).toBe("Sate Babi");
  });
});

describe("catalog drafts", () => {
  it("parses aliases and rejects a long one", () => {
    expect(parseAliases("sate babi, Sate Babi, jeroan")).toEqual({ aliases: ["sate babi", "jeroan"] });
    expect(parseAliases("x".repeat(201))).toEqual({ error: "Alias terlalu panjang." });
  });

  it("requires a product name and a short location label", () => {
    expect(productDraftError("  ")).toBe("Isi nama produk.");
    expect(productDraftError("Sate Babi")).toBeNull();
    expect(locationDraftError("?", "PIK")).toBe("Isi label lokasi.");
    expect(locationDraftError("PIK2", "")).toBeNull();
    expect(locationDraftError("x".repeat(81), "")).toBe("Label lokasi terlalu panjang.");
  });
});
