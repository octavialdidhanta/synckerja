import { describe, expect, it } from "vitest";
import { matchSubcategoryPhoto } from "../../../supabase/functions/_shared/describeCatalogProduct";
import {
  catalogSlug,
  existingMenuForSource,
  linkedProductName,
  sourceForMenu,
  studioProductSources,
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
    expect(existingMenuForSource("sate babi", menus)).toEqual({ menuId: "m1" });
    expect(existingMenuForSource("Teh", menus)).toEqual({ create: true });
    expect(existingMenuForSource("Kopi", menus)).toEqual({ error: "Nama ini sudah tertaut." });
    expect(unlinkedSources([{ id: "p1", kind: "item" }, { id: "p2", kind: "item" }], menus).map((item) => item.id)).toEqual(["p2"]);
  });

  it("attaches a name that only adds a trailing price note", () => {
    const priced = [
      { id: "m3", nama: "Sop Kaki Kambing Kuah Susu (80K)", defaultPriceId: null, featureId: null },
      { id: "m4", nama: "Gulai Kambing Mix", defaultPriceId: null, featureId: null },
      { id: "m5", nama: "Sate Kambing Full Daging (74K)", defaultPriceId: null, featureId: null },
    ];
    expect(existingMenuForSource("Sop Kaki Kambing Kuah Susu", priced)).toEqual({ menuId: "m3" });
    expect(existingMenuForSource("Gulai Kambing", priced)).toEqual({ create: true });
    expect(existingMenuForSource("Sate Kambing Full Dading", priced)).toEqual({ create: true });
  });

  it("does not guess when two products collapse to the same name", () => {
    const doubled = [
      { id: "a", nama: "Sop (80K)", defaultPriceId: null, featureId: null },
      { id: "b", nama: "Sop (90K)", defaultPriceId: null, featureId: null },
    ];
    expect(existingMenuForSource("Sop", doubled)).toEqual({ error: "Ada lebih dari satu produk dengan nama ini." });
  });

  it("shows a content-plan subcategory only when it is not already a product", () => {
    const sources = studioProductSources(
      [
        { id: "p1", name: "Teh Kotak", photoPath: "item/teh.jpg" },
        { id: "p2", name: "Nasi Putih (Lbs)", photoPath: null },
      ],
      [
        { id: "s1", name: "Teh Kotak", photoPath: null, catalogProductId: "p1" },
        { id: "s2", name: "test1", photoPath: "sub/test1.png", catalogProductId: null },
        { id: "s3", name: "Nasi Putih", photoPath: null, catalogProductId: null },
      ],
    );
    expect(sources.map((source) => source.name)).toEqual(["Teh Kotak", "Nasi Putih (Lbs)", "test1", "Nasi Putih"]);
    const saved = [{ id: "m", nama: "test1", defaultPriceId: null, featureId: null, subServiceId: null }];
    expect(unlinkedSources(sources, saved).map((source) => source.name)).toEqual(["Teh Kotak", "Nasi Putih (Lbs)", "Nasi Putih"]);
  });

  it("names the same subcategory photo the product page would", () => {
    const items = [
      { id: "p1", name: "Teh Kotak", photoPath: "item/teh.jpg" },
      { id: "p2", name: "Nasi Putih (Lbs)", photoPath: null },
    ];
    const subcategories = [
      { id: "s1", name: "Teh Kotak", photoPath: "sub/teh.jpg", catalogProductId: "p1" },
      { id: "s2", name: "Sop Kaki Kambing Kuah Susu", photoPath: "sub/sop.jpg", catalogProductId: null },
      { id: "s3", name: "Nasi Putih", photoPath: "sub/nasi.jpg", catalogProductId: null },
      { id: "s4", name: "Sop (90K)", photoPath: "sub/sop-90.jpg", catalogProductId: null },
      { id: "s5", name: "Sop (80K)", photoPath: "sub/sop-80.jpg", catalogProductId: null },
    ];
    const sources = studioProductSources(items, [...subcategories].sort((a, b) => a.name.localeCompare(b.name)));
    const cases = [
      { nama: "Sop Kaki Kambing Kuah Susu (80K)", defaultPriceId: null, featureId: null, subServiceId: null },
      { nama: "Nasi Putih (Lbs)", defaultPriceId: null, featureId: null, subServiceId: null },
      { nama: "Teh Kotak", defaultPriceId: null, featureId: null, subServiceId: null },
      { nama: "Sop", defaultPriceId: null, featureId: null, subServiceId: null },
      { nama: "Sop Kaki Kambing Kuah Susu (80K)", defaultPriceId: "p9", featureId: null, subServiceId: null },
    ];
    for (const menu of cases) {
      const page = sourceForMenu(menu, sources);
      const named = page?.kind === "subcategory" ? page : null;
      expect(matchSubcategoryPhoto({
        menuName: menu.nama,
        linked: Boolean(menu.defaultPriceId || menu.featureId || menu.subServiceId),
        items,
        subcategories: subcategories.map((row) => ({
          name: row.name,
          imagePath: row.photoPath,
          catalogProductId: row.catalogProductId,
        })),
      })).toEqual(named ? { name: named.name, imagePath: named.photoPath } : null);
    }
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
