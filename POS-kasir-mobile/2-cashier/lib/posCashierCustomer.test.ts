import { describe, expect, it } from "vitest";
import {
  posCashierCustomerFromLead,
  posCashierCustomerFromLoyalty,
  posCashierCustomerBillLabel,
  posMemberPhoneLocalDigits,
  posSessionOnlyGuest,
  isSessionOnlyGuest,
} from "./posCashierCustomer";

describe("posMemberPhoneLocalDigits", () => {
  it("strips 62 / 0 prefixes", () => {
    expect(posMemberPhoneLocalDigits("6281281714855")).toBe("81281714855");
    expect(posMemberPhoneLocalDigits("081281714855")).toBe("81281714855");
    expect(posMemberPhoneLocalDigits("+62 812 8171 4855")).toBe("81281714855");
  });
});

describe("posCashierCustomerFromLead", () => {
  it("uses the CRM personal name instead of a cashier-typed name", () => {
    expect(
      posCashierCustomerFromLead({
        leadId: "lead-octa",
        client: "Octa Vialdi",
        phone: "081281714855",
        typedName: "Linda",
      }),
    ).toEqual({
      leadId: "lead-octa",
      name: "Octa Vialdi",
      phone: "6281281714855",
      boundByPhone: true,
    });
  });

  it("fills a generic CRM name with a usable typed name", () => {
    expect(
      posCashierCustomerFromLead({
        leadId: "lead-walk",
        client: "Walk-in",
        phone: "628111111111",
        typedName: "Linda",
      }).name,
    ).toBe("Linda");
  });
});

describe("posSessionOnlyGuest", () => {
  it("does not bind a lead or phone", () => {
    const guest = posSessionOnlyGuest("Linda");
    expect(guest).toEqual({
      leadId: null,
      name: "Linda",
      phone: "",
      boundByPhone: false,
    });
    expect(isSessionOnlyGuest(guest)).toBe(true);
  });
});

describe("posCashierCustomerFromLoyalty", () => {
  it("marks phone-backed loyalty rows as bound", () => {
    expect(
      posCashierCustomerFromLoyalty({
        id: "lead-1",
        name: "Sari",
        phone: "6281234567890",
      }),
    ).toMatchObject({
      leadId: "lead-1",
      boundByPhone: true,
    });
  });
});

describe("posCashierCustomerBillLabel", () => {
  it("hides generic Walk-in so the button stays Add Customer", () => {
    expect(
      posCashierCustomerBillLabel({
        leadId: null,
        name: "Walk-in",
        phone: "",
        boundByPhone: false,
      }),
    ).toBeNull();
  });

  it("shows a personal name", () => {
    expect(
      posCashierCustomerBillLabel({
        leadId: "x",
        name: "Linda",
        phone: "62811",
        boundByPhone: true,
      }),
    ).toBe("Linda");
  });
});
