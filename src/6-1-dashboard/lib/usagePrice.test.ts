import { describe, expect, it } from "vitest";
import { formatUsageCostDetail, usageCostIdr, usageCostLines } from "@/6-1-dashboard/lib/usagePrice";

describe("usageCostIdr", () => {
  it("prices Eleven v4 characters at the list rate", () => {
    expect(usageCostIdr({ model: "eleven_v4", amount: 691, unit: "character" })).toBe(995);
    expect(formatUsageCostDetail([{ quantity: 691, usdPerUnit: 0.08, scale: 1000 }])).toBe("691 × $0.08/1.000 × Rp18.006");
  });

  it("prices speech-to-speech credits the same as TTS list rate", () => {
    expect(usageCostIdr({ model: "eleven_multilingual_sts_v2", amount: 80, unit: "character" })).toBe(115);
    expect(usageCostIdr({ model: "eleven_multilingual_sts_v2", amount: 3088, unit: "character" })).toBe(4448);
    expect(formatUsageCostDetail(usageCostLines({ model: "eleven_multilingual_sts_v2", amount: 48, unit: "character" }) ?? [])).toBe(
      "48 × $0.08/1.000 × Rp18.006",
    );
  });

  it("prices one Flash Image call from its recorded tokens", () => {
    expect(usageCostIdr({ model: "gemini-2.5-flash-image", amount: 3312, unit: "token" })).toBe(708);
  });

  it("prices Gemini 3 Pro Image preview tokens at the list rates", () => {
    // 1.120 image @ $120/1M + 2.007 remainder @ $2/1M → USD 0.138414 → Rp 2.492
    expect(usageCostIdr({ model: "gemini-3-pro-image-preview", amount: 3127, unit: "token" })).toBe(2492);
    expect(formatUsageCostDetail(usageCostLines({ model: "gemini-3-pro-image-preview", amount: 3127, unit: "token" }) ?? [])).toBe(
      "1.120 × $120/1.000.000 + 2.007 × $2/1.000.000 × Rp18.006",
    );
  });

  it("prices a 10 second 720p Omni video from recorded tokens", () => {
    expect(usageCostIdr({
      model: "gemini-omni-1.1-flash",
      amount: 63200,
      unit: "token",
      targetLabel: "Baris 1 · 10 dtk · 720p",
    })).toBe(18393);
  });

  it("prices Veo by the published per-second rate", () => {
    expect(usageCostIdr({
      model: "veo-3.1-lite-generate-preview",
      amount: 1000,
      unit: "token",
      targetLabel: "Baris 2 · 8 dtk · 720p",
    })).toBe(7202);
  });

  it("writes the formula from the same lines that produce the rupiah", () => {
    const image = usageCostLines({ model: "gemini-2.5-flash-image", amount: 3312, unit: "token" });
    const video = usageCostLines({
      model: "gemini-omni-1.1-flash",
      amount: 63200,
      unit: "token",
      targetLabel: "Baris 1 · 10 dtk · 720p",
    });
    expect(formatUsageCostDetail(image ?? [])).toBe("1.290 × $30/1.000.000 + 2.022 × $0.30/1.000.000 × Rp18.006");
    expect(formatUsageCostDetail(video ?? [])).toBe("57.920 × $17.50/1.000.000 + 5.280 × $1.50/1.000.000 × Rp18.006");
  });

  it("prices Gemini 2.5 Flash text tokens at the input list rate", () => {
    expect(usageCostIdr({ model: "gemini-2.5-flash", amount: 4362, unit: "token" })).toBe(24);
    expect(formatUsageCostDetail(usageCostLines({ model: "gemini-2.5-flash", amount: 4362, unit: "token" }) ?? [])).toBe("4.362 × $0.30/1.000.000 × Rp18.006");
  });

  it("prices Gemini 2.5 Flash text from stored input and output tokens", () => {
    const lines = usageCostLines({
      model: "gemini-2.5-flash",
      amount: 4362,
      unit: "token",
      inputTokens: 3000,
      outputTokens: 1362,
    });
    expect(usageCostIdr({
      model: "gemini-2.5-flash",
      amount: 4362,
      unit: "token",
      inputTokens: 3000,
      outputTokens: 1362,
    })).toBe(78);
    expect(formatUsageCostDetail(lines ?? [])).toBe("3.000 × $0.30/1.000.000 + 1.362 × $2.50/1.000.000 × Rp18.006");
  });

  it("leaves an unknown model blank", () => {
    expect(usageCostIdr({ model: "dreamina-seedance-2-5-260628", amount: 100, unit: "token" })).toBeNull();
    expect(usageCostIdr({ model: "eleven_v4", amount: null, unit: "character" })).toBeNull();
  });
});
