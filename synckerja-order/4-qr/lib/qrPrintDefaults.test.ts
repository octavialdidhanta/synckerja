import { describe, expect, it } from "vitest";
import { defaultQrPrintCopy, defaultQrSettingsDraft } from "./qrPrintDefaults";

describe("defaultQrPrintCopy", () => {
  it("returns Indonesian defaults", () => {
    expect(defaultQrPrintCopy("id").headline).toBe("Scan untuk pesan");
  });

  it("returns English defaults", () => {
    expect(defaultQrPrintCopy("en").headline).toBe("Scan to order");
  });
});

describe("defaultQrSettingsDraft", () => {
  it("has classic template and a4 paper", () => {
    const draft = defaultQrSettingsDraft();
    expect(draft.template_id).toBe("classic");
    expect(draft.paper_size).toBe("a4");
    expect(draft.show_url).toBe(false);
  });
});
