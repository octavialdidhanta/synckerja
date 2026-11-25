import { describe, expect, it } from "vitest";
import { industryKeysToDrop, industrySwitchClearsProductText } from "./useCatalogSettings";

const pack = [
  "hijab",
  "watermark_ui",
  "lengkuas",
  "meja_biru",
  "on_model",
  "flat_lay",
  "capacity_shown",
  "product_color_dark",
];

describe("industryKeysToDrop", () => {
  it("drops tags from other packs and keeps the pack being applied plus hand-added tags", () => {
    const org = [
      "watermark_ui",
      "capacity_shown",
      "on_model",
      "product_color_dark",
      "lengkuas",
      "flat_lay",
      "meja_biru",
      "catatan_sendiri",
    ];
    const electronics = ["watermark_ui", "capacity_shown", "product_color_dark"];
    expect(industryKeysToDrop(org, pack, electronics).sort()).toEqual(
      ["flat_lay", "lengkuas", "meja_biru", "on_model"].sort(),
    );
  });

  it("keeps a key that is not in any industry pack", () => {
    expect(industryKeysToDrop(["catatan_sendiri"], pack, ["watermark_ui"])).toEqual([]);
  });
});

describe("industrySwitchClearsProductText", () => {
  it("clears product text only when the active template changes", () => {
    expect(industrySwitchClearsProductText(null, "fnb")).toBe(false);
    expect(industrySwitchClearsProductText("fnb", "fnb")).toBe(false);
    expect(industrySwitchClearsProductText("fnb", "fashion")).toBe(true);
  });
});
