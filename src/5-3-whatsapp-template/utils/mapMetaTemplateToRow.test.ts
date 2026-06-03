import { describe, expect, it } from "vitest";
import type { MetaMessageTemplate } from "../types";
import { mapMetaTemplateToRow, qualityScoreToDisplayLabel } from "./mapMetaTemplateToRow";

function baseMeta(overrides: Partial<MetaMessageTemplate> = {}): MetaMessageTemplate {
  return {
    id: "1256143123383436",
    name: "new_leads_vialdi_id",
    status: "APPROVED",
    category: "MARKETING",
    language: "id",
    components: [{ type: "BODY", text: "Hello {{1}}" }],
    ...overrides,
  };
}

describe("mapMetaTemplateToRow", () => {
  it("maps quality UNKNOWN from Meta as Quality pending", () => {
    const row = mapMetaTemplateToRow(
      baseMeta({ quality_score: { score: "UNKNOWN", date: 1_700_000_000 } }),
    );
    expect(row?.qualityLabel).toBe("Quality pending");
    expect(row?.qualityRaw).toBe("UNKNOWN");
    expect(row?.qualityFromMeta).toBe(true);
  });

  it("maps quality GREEN as High quality", () => {
    const row = mapMetaTemplateToRow(baseMeta({ quality_score: { score: "GREEN" } }));
    expect(row?.qualityLabel).toBe("High quality");
    expect(row?.qualityRaw).toBe("GREEN");
  });

  it("shows Approved status without quality suffix", () => {
    const row = mapMetaTemplateToRow(baseMeta());
    expect(row?.statusLabel).toBe("Approved");
    expect(row?.statusRaw).toBe("APPROVED");
  });

  it("uses TEXT for text-only header in Media column", () => {
    const row = mapMetaTemplateToRow(
      baseMeta({
        components: [
          { type: "HEADER", format: "TEXT", text: "Hi" },
          { type: "BODY", text: "Body" },
        ],
      }),
    );
    expect(row?.mediaFormat).toBe("TEXT");
  });

  it("shows — for Media on body-only template", () => {
    const row = mapMetaTemplateToRow(baseMeta());
    expect(row?.mediaFormat).toBeNull();
  });

  it("maps template analytics delivered and read rate", () => {
    const row = mapMetaTemplateToRow(
      baseMeta({
        _template_analytics: { messages_delivered: 100, messages_read: 80 },
      }),
    );
    expect(row?.messagesDelivered).toBe(100);
    expect(row?.readRatePercent).toBe(80);
  });

  it("top block reason only when Meta provides rejected_reason on paused", () => {
    const approved = mapMetaTemplateToRow(baseMeta());
    expect(approved?.topBlockReason).toBeNull();

    const paused = mapMetaTemplateToRow(
      baseMeta({ status: "PAUSED", rejected_reason: "LOW_QUALITY" }),
    );
    expect(paused?.topBlockReason).toBe("LOW_QUALITY");
  });
});

describe("qualityScoreToDisplayLabel", () => {
  it("maps Meta enums", () => {
    expect(qualityScoreToDisplayLabel("YELLOW")).toBe("Medium quality");
    expect(qualityScoreToDisplayLabel("RED")).toBe("Low quality");
  });
});
