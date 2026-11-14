import { describe, expect, it } from "vitest";
import { catalogContext, sameCatalogLink, withCategory, type LabCatalog } from "@/thinking-lab/master-thought/catalog";

const catalogs: LabCatalog[] = [
  {
    id: "cat-1",
    name: "Warung Contoh",
    subCategories: [{ id: "sub-1", name: "Iga Bakar" }, { id: "sub-2", name: "Sop Iga" }],
    features: [{ id: "feat-1", name: "Daging Empuk" }],
  },
  { id: "cat-2", name: "Toko Lain", subCategories: [{ id: "sub-9", name: "Paket A" }], features: [] },
];

describe("Master Thought catalog", () => {
  it("names the linked category, sub-categories, and features", () => {
    expect(catalogContext({ serviceId: "cat-1", subServiceIds: ["sub-2"], featureIds: ["feat-1"] }, catalogs)).toEqual({
      category: "Warung Contoh",
      subCategories: ["Sop Iga"],
      features: ["Daging Empuk"],
    });
  });

  it("is null until a known category is linked", () => {
    expect(catalogContext({ serviceId: null, subServiceIds: [], featureIds: [] }, catalogs)).toBeNull();
    expect(catalogContext({ serviceId: "gone", subServiceIds: [], featureIds: [] }, catalogs)).toBeNull();
  });

  it("drops picks that do not belong to a newly chosen category", () => {
    const link = withCategory({ serviceId: "cat-1", subServiceIds: ["sub-1"], featureIds: ["feat-1"] }, "cat-2", catalogs);
    expect(link).toEqual({ serviceId: "cat-2", subServiceIds: [], featureIds: [] });
  });

  it("compares links without caring about order", () => {
    expect(
      sameCatalogLink(
        { serviceId: "cat-1", subServiceIds: ["sub-1", "sub-2"], featureIds: [] },
        { serviceId: "cat-1", subServiceIds: ["sub-2", "sub-1"], featureIds: [] },
      ),
    ).toBe(true);
  });
});
