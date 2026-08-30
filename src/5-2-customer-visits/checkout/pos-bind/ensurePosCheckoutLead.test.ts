import { describe, expect, it } from "vitest";
import { planPosCheckoutLeadWrite } from "./ensurePosCheckoutLead";
import {
  resolvePosCheckoutClientPatch,
  resolvePosCheckoutInsertClient,
  shouldRecordPosPaidCustomerVisit,
} from "./posCheckoutLeadGuards";

describe("planPosCheckoutLeadWrite", () => {
  it("inserts a Walk-in without phone when skipped", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: null,
        requestedName: null,
        existingId: null,
        existingClient: null,
      }),
    ).toEqual({
      action: "insert_walkin",
      client: "Walk-in",
      boundByPhone: false,
    });
  });

  it("reuses a matched lead and only patches a generic name", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        requestedName: "Budi",
        existingId: "magnet",
        existingClient: "Walk-in",
      }),
    ).toEqual({
      action: "reuse",
      leadId: "magnet",
      phoneKey: "6281234567890",
      clientPatch: "Budi",
      boundByPhone: true,
    });
  });

  it("does not overwrite a personal CRM name", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        requestedName: "Walk-in",
        existingId: "magnet",
        existingClient: "vialdi.id",
      }),
    ).toEqual({
      action: "reuse",
      leadId: "magnet",
      phoneKey: "6281234567890",
      clientPatch: null,
      boundByPhone: true,
    });
  });

  it("inserts POS + phone when nothing matches", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        requestedName: "Sari",
        existingId: null,
        existingClient: null,
      }),
    ).toEqual({
      action: "insert_with_phone",
      phoneKey: "6281234567890",
      client: "Sari",
      boundByPhone: true,
    });
  });
});

describe("resolvePosCheckoutClientPatch", () => {
  it("rejects names shorter than 2 characters", () => {
    expect(resolvePosCheckoutClientPatch("Walk-in", "A")).toBeNull();
  });

  it("rejects generic requested names", () => {
    expect(resolvePosCheckoutClientPatch("Walk-in", "Walk-in")).toBeNull();
  });
});

describe("resolvePosCheckoutInsertClient", () => {
  it("falls back to Walk-in", () => {
    expect(resolvePosCheckoutInsertClient("")).toBe("Walk-in");
    expect(resolvePosCheckoutInsertClient("—")).toBe("Walk-in");
  });
});

describe("shouldRecordPosPaidCustomerVisit", () => {
  it("records only when the receipt is bound by phone", () => {
    expect(shouldRecordPosPaidCustomerVisit(false)).toBe(false);
    expect(shouldRecordPosPaidCustomerVisit(true)).toBe(true);
  });
});
