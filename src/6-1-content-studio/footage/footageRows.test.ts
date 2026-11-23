import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  buildFootageRows,
  countLabel,
  filterOptions,
  optionCount,
  visibleRows,
  type FootageSource,
} from "./footageRows";

const src: FootageSource = {
  assets: [
    { id: "a1", file_key: "PIK1/sate babi/clip1.mp4", media_type: "video", location_label: "PIK1", product_label: "sate babi", summary: "Klip satu", storage_status: "bank", duration_seconds: 6 },
    { id: "a2", file_key: "PIK2/sop/clip2.mp4", media_type: "video", location_label: "PIK2", product_label: "sop sumsum;sate kambing", summary: "Klip dua", storage_status: "inbox", duration_seconds: 4 },
    { id: "a3", file_key: "PIK1/foto/a.jpg", media_type: "image", location_label: null, product_label: "suasana", summary: "Foto", storage_status: "bank", duration_seconds: null },
  ],
  scenes: [
    { id: "s2", asset_id: "a1", start_seconds: "2.5", end_seconds: null, scene_kind: "orang", summary: "Gigit sate", note: "", thumb_storage_path: "o/thumbs/s2.jpg" },
    { id: "s1", asset_id: "a1", start_seconds: 0, end_seconds: 2.5, scene_kind: "produk", summary: "Sate dibakar", note: "keju", thumb_storage_path: "o/thumbs/s1.jpg" },
    { id: "s3", asset_id: "a2", start_seconds: 0, end_seconds: 4, scene_kind: "produk", summary: "Sumsum disedot", note: null, thumb_storage_path: null },
    { id: "s4", asset_id: "a3", start_seconds: 0, end_seconds: null, scene_kind: "suasana", summary: "Foto teras", note: null, thumb_storage_path: null },
    { id: "orphan", asset_id: "deleted", start_seconds: 0, end_seconds: 1, scene_kind: "produk", summary: "x", note: null, thumb_storage_path: null },
  ],
  tagDefs: [
    { id: "t1", key: "hijab" },
    { id: "t2", key: "watermark_ui" },
    { id: "t3", key: "lengkuas" },
    { id: "t4", key: "meja_biru" },
  ],
  tagValues: [
    { tag_def_id: "t1", asset_id: null, scene_id: "s2", value_bool: true, value_text: null },
    { tag_def_id: "t3", asset_id: null, scene_id: "s1", value_bool: false, value_text: null },
    { tag_def_id: "t4", asset_id: null, scene_id: "s3", value_bool: true, value_text: null },
  ],
  usages: [
    { asset_id: "a1", scene_id: "s1", external_ref: "00d86b81", social_media_plan_id: null },
    { asset_id: "a1", scene_id: "s1", external_ref: "e2fb3654", social_media_plan_id: null },
    { asset_id: "a1", scene_id: null, external_ref: "00d86b81", social_media_plan_id: null },
    { asset_id: "a1", scene_id: null, in_seconds: "3.0", out_seconds: 5, external_ref: "8dd2877b", social_media_plan_id: null },
    { asset_id: "a2", scene_id: null, external_ref: null, social_media_plan_id: "bd995747-5f9d-418c" },
  ],
  bans: [{ scene_id: "s2", reason: "senyum AI" }],
  menus: [
    { name: "Sate Babi", aliases: ["sate babi"] },
    { name: "Sup Sum Sum Kambing", aliases: ["sop sumsum", "sup sumsum"] },
    { name: "Sate Kambing Full Daging (74K)", aliases: ["sate kambing"] },
    { name: "Iga bakar", aliases: ["iga bakar"] },
  ],
};

describe("buildFootageRows", () => {
  const data = buildFootageRows(src);
  const byId = Object.fromEntries(data.rows.map((r) => [r.id, r]));

  it("orders by file and numbers scenes by start time, skipping orphans", () => {
    expect(data.rows.map((r) => r.id)).toEqual(["s4", "s1", "s2", "s3"]);
    expect(byId.s1.sc).toBe(1);
    expect(byId.s2.sc).toBe(2);
    expect(byId.s2.a).toBe(2.5);
    expect(byId.s2.b).toBe(6); // falls back to clip duration
  });

  it("maps tags, usages, bans, products, and labels like katalog.html", () => {
    expect(byId.s2.hijab).toBe("ya");
    expect(byId.s2.ban).toBe("senyum AI");
    expect(byId.s1.lengkuas).toBe("tidak");
    expect(byId.s3.meja).toBe(true);
    expect(byId.s1.sp).toEqual(["00d86b81", "e2fb3654"]);
    expect(byId.s1.pakai).toBe("00d86b81;e2fb3654;8dd2877b");
    // clip usage with in/out counts for the scene it overlaps (2.5–6s), not the other one
    expect(byId.s2.sp).toEqual(["8dd2877b"]);
    expect(byId.s3.pakai).toBe("bd995747");
    expect(byId.s3.prod).toEqual(["Sup Sum Sum Kambing", "Sate Kambing Full Daging (74K)"]);
    expect(byId.s3.baru).toBe(true);
    expect(byId.s4.lok).toBe("?");
    expect(byId.s4.tipe).toBe("gambar");
  });

  it("keeps only menu products with footage as product options, in menu order", () => {
    expect(data.productOrder).toEqual(["Sate Babi", "Sup Sum Sum Kambing", "Sate Kambing Full Daging (74K)"]);
    expect(filterOptions(data).lok).toEqual(["?", "PIK1", "PIK2"]);
  });
});

describe("filters", () => {
  const { rows } = buildFootageRows(src);

  it("filters by status, usage per view, and search", () => {
    expect(visibleRows(rows, { ...EMPTY_FILTERS, st: "jangan dipakai" }, "", "scene").map((r) => r.id)).toEqual(["s2"]);
    expect(visibleRows(rows, { ...EMPTY_FILTERS, pakai: "2x+" }, "", "scene").map((r) => r.id)).toEqual(["s1"]);
    expect(visibleRows(rows, { ...EMPTY_FILTERS, pakai: "2x+" }, "", "klip").map((r) => r.id)).toEqual(["s1"]);
    expect(visibleRows(rows, EMPTY_FILTERS, "KEJU", "scene").map((r) => r.id)).toEqual(["s1"]);
    expect(visibleRows(rows, EMPTY_FILTERS, "sate kambing", "scene").map((r) => r.id)).toEqual(["s3"]);
  });

  it("dedupes clips in klip view and counts like the header", () => {
    const L = visibleRows(rows, EMPTY_FILTERS, "", "klip");
    expect(L).toHaveLength(3);
    expect(countLabel(L, "klip")).toBe("3 klip");
    expect(countLabel(visibleRows(rows, EMPTY_FILTERS, "", "scene"), "scene")).toBe("4 scene · 3 klip");
  });

  it("counts each option using the other active filters only", () => {
    const F = { ...EMPTY_FILTERS, lok: "PIK1" };
    expect(optionCount(rows, F, "", "scene", "lok", null)).toBe(4);
    expect(optionCount(rows, F, "", "scene", "jenis", "produk")).toBe(1);
    expect(optionCount(rows, F, "", "scene", "prod", "Sate Babi")).toBe(2);
  });
});

describe("AI tag status (Synckerja Agent)", () => {
  it("rows carry the clip tag status and the Tag filter only shows when something needs a look", () => {
    const plain = buildFootageRows(src);
    expect(plain.rows.every((r) => r.tag === "dicek")).toBe(true);
    expect(filterOptions(plain).tag).toEqual([]);

    const withAi = buildFootageRows({
      ...src,
      assets: src.assets.map((a) => (a.id === "a2" ? { ...a, tag_status: "perlu_dicek" } : a)),
    });
    expect(withAi.rows.find((r) => r.assetId === "a2")?.tag).toBe("perlu_dicek");
    expect(filterOptions(withAi).tag).toEqual(["perlu_dicek", "belum", "dicek"]);
    const F = { ...EMPTY_FILTERS, tag: "perlu_dicek" };
    expect(visibleRows(withAi.rows, F, "", "scene").map((r) => r.id)).toEqual(["s3"]);
    expect(optionCount(withAi.rows, F, "", "scene", "tag", "dicek")).toBe(3);
  });
});
