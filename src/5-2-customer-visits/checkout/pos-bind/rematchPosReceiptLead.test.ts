import { describe, expect, it } from "vitest";
import { planPosReceiptRematch } from "./rematchPosReceiptLead";
import type { PosCheckoutLeadRow } from "./posCheckoutLead.types";

const magnet: PosCheckoutLeadRow = {
  id: "magnet",
  client: "vialdi.id",
  phone_number: "6281234567890",
  source: "Lead Magnet",
  ticket_id: "LEAD-10F9E361",
  updated_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("planPosReceiptRematch", () => {
  it("rebinds the receipt to Magnet and does not write the phone onto Walk-in", () => {
    expect(
      planPosReceiptRematch({
        currentLeadId: "walk-in",
        picked: magnet,
        phoneKey: "6281234567890",
        requestedName: "Walk-in",
      }),
    ).toEqual({
      action: "rebind",
      winnerLeadId: "magnet",
      personalName: "vialdi.id",
      writePhoneOnCurrent: false,
    });
  });

  it("writes the phone onto the current lead when no other row matches", () => {
    expect(
      planPosReceiptRematch({
        currentLeadId: "walk-in",
        picked: null,
        phoneKey: "6289999999999",
        requestedName: "Sari",
      }),
    ).toEqual({
      action: "update_current",
      phoneKey: "6289999999999",
      personalName: "Sari",
      writePhoneOnCurrent: true,
    });
  });

  it("updates the current lead when it is already the winner", () => {
    expect(
      planPosReceiptRematch({
        currentLeadId: "magnet",
        picked: magnet,
        phoneKey: "6281234567890",
        requestedName: null,
      }),
    ).toEqual({
      action: "update_current",
      phoneKey: "6281234567890",
      personalName: null,
      writePhoneOnCurrent: true,
    });
  });
});
