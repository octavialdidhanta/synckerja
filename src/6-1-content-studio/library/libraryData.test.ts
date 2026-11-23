import { describe, expect, it } from "vitest";
import { buildLocations, buildMenus, isFilled } from "./libraryData";
import { studioTabFromPath } from "../studioTabs";

describe("buildMenus", () => {
  const menus = buildMenus(
    [
      { id: "m2", external_id: "sate-babi", name: "Sate Babi", aliases: ["sate babi"], created_at: "2026-11-22T10:00:00Z" },
      { id: "m1", external_id: "iga-bakar", name: "Iga bakar", aliases: null, created_at: "2026-11-22T10:00:00Z" },
    ],
    [
      { menu_id: "m1", field_key: "topping", body: "Bawang goreng", position: 1 },
      { menu_id: "m1", field_key: "main", body: "Iga sapi bakar", position: 0 },
    ],
    [
      { id: "p2", menu_id: "m1", file_path: "foto/b.png", label: "B", storage_path: "o/photos/p2.png", position: 1 },
      { id: "p1", menu_id: "m1", file_path: "foto/a.png", label: "A", storage_path: null, position: 0 },
    ],
  );

  it("sorts menus, fields, and photos, and maps fields by key", () => {
    expect(menus.map((m) => m.externalId)).toEqual(["iga-bakar", "sate-babi"]);
    expect(menus[0].fields).toEqual({ main: "Iga sapi bakar", topping: "Bawang goreng" });
    expect(menus[0].fotos.map((f) => f.label)).toEqual(["A", "B"]);
    expect(menus[1].aliases).toEqual(["sate babi"]);
  });

  it("marks a menu ready only when a field has text", () => {
    expect(isFilled(menus[0])).toBe(true);
    expect(isFilled(menus[1])).toBe(false);
  });
});

describe("buildLocations", () => {
  const locs = buildLocations(
    [
      { id: "l1", external_id: "pik1-foodcourt", name: "PIK1 Foodcourt", created_at: "2026-11-22T10:00:00Z" },
      { id: "l2", external_id: "pik2", name: "PIK2", created_at: "2026-11-22T11:00:00Z" },
    ],
    [
      { id: "f1", location_id: "l1", file_path: "foto/x.jpg", label: "Teras", storage_path: "o/photos/f1.jpg", description: null, areas: ["Teras"], position: 0 },
      { id: "f2", location_id: "l2", file_path: "foto/y.jpg", label: "Depan", storage_path: null, description: "Ruko dua lantai", areas: null, position: 0 },
    ],
    [
      { location_id: "l1", title: "Atmosphere", body: "Ramai", areas: null, position: 1 },
      { location_id: "l1", title: "Scene", body: "", areas: ["Teras"], position: 0 },
    ],
  );

  it("keeps section order and areas", () => {
    expect(locs[0].bagian.map((b) => b.judul)).toEqual(["Scene", "Atmosphere"]);
    expect(locs[0].bagian[0].area).toEqual(["Teras"]);
    expect(locs[0].fotos[0].area).toEqual(["Teras"]);
  });

  it("is ready with a section body or a photo description", () => {
    expect(isFilled(locs[0])).toBe(true);
    expect(isFilled(locs[1])).toBe(true);
    expect(isFilled({ ...locs[1], fotos: [] })).toBe(false);
  });
});

describe("studioTabFromPath", () => {
  it("reads the tab from the last path segment", () => {
    expect(studioTabFromPath("/digital-marketing/social-media/content-studio/produk")).toBe("produk");
    expect(studioTabFromPath("/digital-marketing/social-media/content-studio/lokasi/")).toBe("lokasi");
    expect(studioTabFromPath("/digital-marketing/social-media/content-studio/shot-list")).toBe("shot-list");
    expect(studioTabFromPath("/digital-marketing/social-media/content-studio/referensi")).toBe("referensi");
    expect(studioTabFromPath("/digital-marketing/social-media/content-studio/gaya")).toBe("footage");
    expect(studioTabFromPath("/digital-marketing/social-media/content-studio")).toBe("footage");
  });
});
