import { describe, expect, it } from "vitest";
import { pickPosCheckoutLead } from "./pickPosCheckoutLead";
import type { PosCheckoutLeadRow } from "./posCheckoutLead.types";

function lead(partial: Partial<PosCheckoutLeadRow> & Pick<PosCheckoutLeadRow, "id">): PosCheckoutLeadRow {
  return {
    client: "Walk-in",
    phone_number: "6281234567890",
    source: "POS",
    ticket_id: `pos-walkin-${partial.id}`,
    updated_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("pickPosCheckoutLead", () => {
  it("prefers Lead Magnet over Walk-in duplicates of the same number", () => {
    const walkIn = lead({
      id: "walk-in",
      client: "Walk-in",
      phone_number: "081234567890",
      source: "POS",
      updated_at: "2026-08-30T10:00:00.000Z",
    });
    const magnet = lead({
      id: "magnet",
      client: "vialdi.id",
      phone_number: "6281234567890",
      source: "Lead Magnet",
      ticket_id: "LEAD-10F9E361",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(pickPosCheckoutLead([walkIn, magnet])?.id).toBe("magnet");
  });

  it("prefers LEAD- ticket when source is not Magnet", () => {
    const ads = lead({
      id: "ads",
      client: "Andi",
      source: "Website",
      ticket_id: "LEAD-AAAA",
    });
    const pos = lead({
      id: "pos",
      client: "Andi",
      source: "POS",
      ticket_id: "pos-walkin-1",
    });
    expect(pickPosCheckoutLead([pos, ads])?.id).toBe("ads");
  });

  it("prefers enrolled lead when source/ticket are generic", () => {
    const enrolled = lead({ id: "enrolled", client: "Walk-in", source: "Instagram", ticket_id: "IG-1" });
    const other = lead({ id: "other", client: "Walk-in", source: "POS", ticket_id: "pos-walkin-2" });
    expect(pickPosCheckoutLead([other, enrolled], new Set(["enrolled"]))?.id).toBe("enrolled");
  });

  it("prefers a personal name over Walk-in when neither is attributed", () => {
    const generic = lead({ id: "generic", client: "Walk-in", updated_at: "2026-08-30T12:00:00.000Z" });
    const named = lead({
      id: "named",
      client: "Budi",
      source: "POS",
      ticket_id: "pos-walkin-3",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(pickPosCheckoutLead([generic, named])?.id).toBe("named");
  });

  it("falls back to the latest updated_at", () => {
    const older = lead({ id: "older", updated_at: "2026-01-01T00:00:00.000Z" });
    const newer = lead({ id: "newer", updated_at: "2026-08-30T00:00:00.000Z" });
    expect(pickPosCheckoutLead([older, newer])?.id).toBe("newer");
  });

  it("returns null for an empty list", () => {
    expect(pickPosCheckoutLead([])).toBeNull();
  });
});
