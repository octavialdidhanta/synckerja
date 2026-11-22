import { describe, expect, it } from "vitest";
import { buildLocations, buildMenus } from "../library/libraryData";
import { allPhotos, buildFlowPrompt, defaultSelection, ftag } from "./buildFlowPrompt";
import { missingMenus, parseShotJob, splitJobs } from "./shotData";

const fields = {
  judul: "MASTER PROMPT",
  format: "Vertical 9:16.",
  visual: "UGC look.",
  audio: "No music.",
  integrity: "Real hands.\nOne continuous shot with no cuts, no angle changes and no transitions.",
  independence: "Follow ACTION.",
  ramai: "Busy place.",
  diam: "Nobody speaks.",
  diam_akhir: "Reminder: no talking.",
  ngomong: "Talks softly.",
  multi_angle: "{N} angles, each {FRAC}:\n{LIST}",
  angle_list: "1) First\n2) Second\n3) Third",
};

const menus = buildMenus(
  [
    { id: "m1", external_id: "sup-sumsum", name: "Sup Sumsum", aliases: [], created_at: "a" },
    { id: "m2", external_id: "sate-kambing", name: "Sate Kambing", aliases: [], created_at: "b" },
  ],
  [
    { menu_id: "m1", field_key: "main", body: "Marrow soup", position: 0 },
    { menu_id: "m1", field_key: "larangan", body: "No curry", position: 1 },
    { menu_id: "m1", field_key: "khusus", body: "No pork.", position: 2 },
    { menu_id: "m2", field_key: "main", body: "Goat satay", position: 0 },
    { menu_id: "m2", field_key: "khusus", body: "No pork.", position: 1 },
  ],
  [
    { id: "p1", menu_id: "m1", file_path: "foto/sup_foto1.png", label: "Sup", storage_path: null, ref: "copy the bowl", position: 0 },
    { id: "p2", menu_id: "m2", file_path: "foto/sate_foto1.png", label: "Sate", storage_path: null, ref: null, position: 0 },
  ],
);
const [loc] = buildLocations(
  [{ id: "l1", external_id: "teras", name: "Teras", created_at: "a" }],
  [
    { id: "f1", location_id: "l1", file_path: "foto/teras-meja.jpg", label: "Meja", storage_path: null, ref: "blue tables", description: "Blue tables.", areas: ["Ruang makan"], position: 0 },
    { id: "f2", location_id: "l1", file_path: "foto/grill.jpg", label: "Grill", storage_path: null, ref: null, description: "A grill.", areas: ["Panggangan"], position: 1 },
  ],
  [
    { location_id: "l1", title: "Atmosphere", body: "Lively.", areas: null, position: 1 },
    { location_id: "l1", title: "Scene", body: "A terrace.", areas: null, position: 0 },
  ],
);

describe("buildFlowPrompt", () => {
  it("builds the one-dish prompt in katalog.html order", () => {
    const refs = allPhotos([menus[0]], loc).filter((p) => defaultSelection([menus[0]], loc, "Ruang makan").has(p.file));
    const r = buildFlowPrompt({
      fields, menus: [menus[0]], loc, refs, action: "Lift a bone.", talk: "diam", angles: 1, curArea: "Ruang makan", allMenus: menus,
    });
    const heads = r.text.split("\n").filter((l) => l.startsWith("## "));
    expect(heads).toEqual([
      "## 1. Format & Light",
      "## 2. Location — Teras",
      "## 3. Main Subject — Sup Sumsum",
      "## 4. Reference Photos",
      "## 5. Visual Style",
      "## 6. Audio",
      "## 7. Scene Integrity",
      "## 8. Background Crowd",
      "## 9. Speaking",
      "## 10. Shot Independence",
      "## 11. Action",
    ]);
    expect(r.text).toContain("### What The Camera Sees (only this part of the location appears, exactly as in the reference photo)\n\n#### @teras-meja\nBlue tables.");
    expect(r.text).toContain("### Scene\nA terrace.");
    expect(r.text).toContain("### Must NOT\nNo curry");
    expect(r.text).toContain("- @sup_foto1 — copy the bowl\n- @teras-meja — blue tables");
    expect(r.text.endsWith("Lift a bone.\n\nNo pork.\n\nReminder: no talking.")).toBe(true);
    expect(r.area).toBe("Ruang makan");
    expect(r.warnings).toEqual([]);
  });

  it("handles several dishes, multi-angle cuts, speaking, and area warnings", () => {
    const refs = allPhotos(menus, loc);
    const r = buildFlowPrompt({
      fields, menus, loc, refs, action: "", talk: "ngomong", angles: 2, curArea: "", shotArea: "Panggangan", allMenus: menus,
    });
    expect(r.text).toContain("## 3. Main Subjects — 2 dishes together");
    expect(r.text).toContain("### Sup Sumsum\nMarrow soup\nMust NOT: No curry");
    expect(r.text).toContain("- @sate_foto1 — the exact look of Sate Kambing (size, color, plating)");
    expect(r.text).toContain("Hard cuts happen only between the camera angles described below");
    expect(r.text).toContain("2 angles, each half:\n1) First\n2) Second\n\n");
    expect(r.text).toContain("## 10. Speaking\nTalks softly.");
    expect(r.text).not.toContain("Reminder: no talking.");
    expect(r.text.match(/No pork\./g)).toHaveLength(1);
    expect(r.text).toContain("(tulis action di atas)");
    // two location areas in use and none picked: no single area, so no mismatch warning
    expect(r.area).toBe("Panggangan");
  });

  it("warns when no location photo is used", () => {
    const refs = allPhotos([menus[0]], loc).filter((p) => p.tp === "Produk");
    const r = buildFlowPrompt({ fields, menus: [menus[0]], loc, refs, action: "x", talk: "diam", angles: 1, curArea: "", allMenus: menus });
    expect(r.noLocationPhoto).toBe(true);
    expect(r.warnings).toContain("belum ada foto lokasi yang dicentang");
    expect(r.text).not.toContain("What The Camera Sees");
  });

  it("names files like katalog.html ftag", () => {
    expect(ftag({ file: "foto/pik1-foodcourt_teras.jpg" })).toBe("@pik1-foodcourt_teras");
  });
});

describe("shot list data", () => {
  const job = parseShotJob("e2fb3654", {
    judul: "Sumsum Disedot",
    lokasi: "teras",
    arsip: true,
    shots: [
      { id: "P01", judul: "Hook", menu: "sup-sumsum", area: "Ruang makan", pick: "Ruang makan", fotos: ["foto/sup_foto1.png"], done: true, angle: 3 },
      { id: "P02", judul: "Ghost", menu: ["iga-bakar"], menu_nama: { "iga-bakar": "Iga Bakar" }, bicara: true },
    ],
  });

  it("parses shots with menus, photos, angle, and talk", () => {
    expect(job.shots[0]).toMatchObject({ menus: ["sup-sumsum"], pick: "Ruang makan", fotos: ["foto/sup_foto1.png"], angle: 3, done: true });
    expect(job.shots[1]).toMatchObject({ menus: ["iga-bakar"], bicara: true, angle: 1, fotos: undefined, pick: undefined });
  });

  it("splits archived jobs and finds menus missing from the catalog", () => {
    expect(splitJobs([job]).archived).toHaveLength(1);
    expect(missingMenus(job.shots[0], menus)).toEqual([]);
    expect(missingMenus(job.shots[1], menus)).toEqual(["Iga Bakar"]);
  });
});
