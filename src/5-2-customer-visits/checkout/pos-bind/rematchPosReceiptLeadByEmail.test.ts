import { describe, expect, it } from "vitest";
import { planPosReceiptEmailRematch } from "./rematchPosReceiptLeadByEmail";
import type { PosCheckoutLeadRow } from "./posCheckoutLead.types";

const magnet: PosCheckoutLeadRow = {
  id: "magnet",
  client: "vialdi.id",
  phone_number: "6281234567890",
  email: "magnet@mail.com",
  source: "Lead Magnet",
  ticket_id: "LEAD-10F9E361",
  updated_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("planPosReceiptEmailRematch", () => {
  it("rebinds the receipt to an existing email owner and does not write email onto Walk-in", () => {
    expect(
      planPosReceiptEmailRematch({
        currentLeadId: "walk-in",
        picked: magnet,
        emailKey: "magnet@mail.com",
        requestedName: "Walk-in",
      }),
    ).toEqual({
      action: "rebind",
      winnerLeadId: "magnet",
      personalName: "vialdi.id",
      writeEmailOnCurrent: false,
    });
  });

  it("writes the email onto the current lead when no other row matches", () => {
    expect(
      planPosReceiptEmailRematch({
        currentLeadId: "walk-in",
        picked: null,
        emailKey: "new@mail.com",
        requestedName: "Sari",
      }),
    ).toEqual({
      action: "update_current",
      emailKey: "new@mail.com",
      personalName: "Sari",
      writeEmailOnCurrent: true,
    });
  });

  it("updates the current lead when it is already the email owner", () => {
    expect(
      planPosReceiptEmailRematch({
        currentLeadId: "magnet",
        picked: magnet,
        emailKey: "magnet@mail.com",
        requestedName: null,
      }),
    ).toEqual({
      action: "update_current",
      emailKey: "magnet@mail.com",
      personalName: null,
      writeEmailOnCurrent: true,
    });
  });

  it("allows rebind when pay was phone-bound to A but email belongs to B", () => {
    expect(
      planPosReceiptEmailRematch({
        currentLeadId: "phone-lead-a",
        picked: magnet,
        emailKey: "magnet@mail.com",
        requestedName: "Octa",
      }).action,
    ).toBe("rebind");
  });
});
