import { describe, expect, it } from "vitest";
import { buildQrCardModel, mergeQrSettings } from "./buildQrCardModel";
import { defaultQrSettingsDraft } from "./qrPrintDefaults";

describe("buildQrCardModel", () => {
  it("builds dine-in URL with table number", () => {
    const model = buildQrCardModel({
      publicCode: "h5gta6",
      table: { id: "t1", name: "meja 1" },
      businessName: "Taman Cibodas",
      outletName: "Outlet Utama",
      logoUrl: null,
      settings: defaultQrSettingsDraft(),
      locale: "id",
    });
    expect(model.qrUrl).toContain("h5gta6");
    expect(model.qrUrl).toContain("tableNumber=meja");
    expect(model.headline).toBe("Scan untuk pesan");
    expect(model.tableLabel).toBe("meja 1");
  });

  it("uses custom headline when provided", () => {
    const model = buildQrCardModel({
      publicCode: "abc123",
      table: { id: "t2", name: "VIP 2" },
      businessName: "Cafe",
      outletName: "Cafe",
      logoUrl: "https://example.com/logo.png",
      settings: {
        ...defaultQrSettingsDraft(),
        headline_text: "Pesan di sini",
        show_logo: true,
      },
      locale: "en",
    });
    expect(model.headline).toBe("Pesan di sini");
    expect(model.logoUrl).toBe("https://example.com/logo.png");
  });
});

describe("mergeQrSettings", () => {
  it("falls back to defaults when saved is null", () => {
    const merged = mergeQrSettings(null, { template_id: "tent" });
    expect(merged.template_id).toBe("tent");
    expect(merged.paper_size).toBe("a4");
  });
});
