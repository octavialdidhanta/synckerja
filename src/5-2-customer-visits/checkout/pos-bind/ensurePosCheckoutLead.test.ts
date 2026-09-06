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
        emailKey: null,
        requestedName: null,
        existingPhoneId: null,
        existingPhoneClient: null,
        existingEmailId: null,
        existingEmailClient: null,
      }),
    ).toEqual({
      action: "insert_walkin",
      client: "Walk-in",
      emailKey: null,
      boundByPhone: false,
      boundByEmail: false,
    });
  });

  it("reuses a matched lead by phone and only patches a generic name", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        emailKey: "a@b.com",
        requestedName: "Budi",
        existingPhoneId: "magnet",
        existingPhoneClient: "Walk-in",
        existingEmailId: null,
        existingEmailClient: null,
      }),
    ).toEqual({
      action: "reuse",
      leadId: "magnet",
      phoneKey: "6281234567890",
      emailKey: "a@b.com",
      clientPatch: "Budi",
      boundByPhone: true,
      boundByEmail: false,
    });
  });

  it("plans bridge_merge when phone and email hit different leads", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        emailKey: "a@b.com",
        requestedName: "Budi",
        existingPhoneId: "phone-lead",
        existingPhoneClient: "Walk-in",
        existingEmailId: "email-lead",
        existingEmailClient: "Other",
      }),
    ).toEqual({
      action: "bridge_merge",
      phoneLeadId: "phone-lead",
      emailLeadId: "email-lead",
      phoneKey: "6281234567890",
      emailKey: "a@b.com",
      boundByPhone: true,
      boundByEmail: true,
    });
  });

  it("reuses one lead when phone and email resolve to the same id", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        emailKey: "a@b.com",
        requestedName: "Budi",
        existingPhoneId: "same",
        existingPhoneClient: "Walk-in",
        existingEmailId: "same",
        existingEmailClient: "Walk-in",
      }).action,
    ).toBe("reuse");
  });

  it("reuses by email when phone is missing", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: null,
        emailKey: "octa@mail.com",
        requestedName: "Octa",
        existingPhoneId: null,
        existingPhoneClient: null,
        existingEmailId: "email-lead",
        existingEmailClient: "Walk-in",
      }),
    ).toEqual({
      action: "reuse_email",
      leadId: "email-lead",
      emailKey: "octa@mail.com",
      phoneKey: null,
      clientPatch: "Octa",
      boundByPhone: false,
      boundByEmail: true,
    });
  });

  it("does not overwrite a personal CRM name", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        emailKey: null,
        requestedName: "Walk-in",
        existingPhoneId: "magnet",
        existingPhoneClient: "vialdi.id",
        existingEmailId: null,
        existingEmailClient: null,
      }),
    ).toEqual({
      action: "reuse",
      leadId: "magnet",
      phoneKey: "6281234567890",
      emailKey: null,
      clientPatch: null,
      boundByPhone: true,
      boundByEmail: false,
    });
  });

  it("inserts POS + phone when nothing matches", () => {
    expect(
      planPosCheckoutLeadWrite({
        phoneKey: "6281234567890",
        emailKey: null,
        requestedName: "Sari",
        existingPhoneId: null,
        existingPhoneClient: null,
        existingEmailId: null,
        existingEmailClient: null,
      }),
    ).toEqual({
      action: "insert_with_phone",
      phoneKey: "6281234567890",
      emailKey: null,
      client: "Sari",
      boundByPhone: true,
      boundByEmail: false,
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
