import { describe, expect, it } from "vitest";
import {
  posCashierCustomerFromLead,
  posCashierCustomerFromLoyalty,
  posCashierCustomerBillLabel,
  posMemberPhoneLocalDigits,
  posSessionOnlyGuest,
  isSessionOnlyGuest,
  normalizePosCashierCustomer,
  sanitizePosPhoneLocalInput,
} from "./posCashierCustomer";
import {
  isOptionalCustomerEmailOk,
  isValidPosCustomerEmail,
} from "./isPosCustomerEmail";

describe("posMemberPhoneLocalDigits", () => {
  it("strips 62 / 0 prefixes", () => {
    expect(posMemberPhoneLocalDigits("6281281714855")).toBe("81281714855");
    expect(posMemberPhoneLocalDigits("081281714855")).toBe("81281714855");
    expect(posMemberPhoneLocalDigits("+62 812 8171 4855")).toBe("81281714855");
  });
});

describe("sanitizePosPhoneLocalInput", () => {
  it("keeps digits and strips leading zeros", () => {
    expect(sanitizePosPhoneLocalInput("0812")).toBe("812");
    expect(sanitizePosPhoneLocalInput("0")).toBe("");
    expect(sanitizePosPhoneLocalInput("812abc90")).toBe("81290");
    expect(sanitizePosPhoneLocalInput("812")).toBe("812");
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
        email: "octa@mail.com",
      }),
    ).toEqual({
      leadId: "lead-octa",
      name: "Octa Vialdi",
      phone: "6281281714855",
      email: "octa@mail.com",
      boundByPhone: true,
    });
  });

  it("prefers typed email over CRM email when both set", () => {
    expect(
      posCashierCustomerFromLead({
        leadId: "lead-1",
        client: "Linda",
        phone: "62811",
        email: "old@mail.com",
        typedEmail: "new@mail.com",
      }).email,
    ).toBe("new@mail.com");
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
      email: "",
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
      email: "",
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
        email: "",
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
        email: "",
        boundByPhone: true,
      }),
    ).toBe("Linda");
  });
});

describe("customer email validation", () => {
  it("rejects glued TLD typos", () => {
    expect(isValidPosCustomerEmail("a@gmail.comsss")).toBe(false);
    expect(isOptionalCustomerEmailOk("")).toBe(true);
    expect(isOptionalCustomerEmailOk("a@gmail.com")).toBe(true);
    expect(isOptionalCustomerEmailOk("a@gmail.comsss")).toBe(false);
  });
});

describe("normalizePosCashierCustomer", () => {
  it("fills missing email on legacy drafts", () => {
    expect(
      normalizePosCashierCustomer({
        leadId: "x",
        name: "Linda",
        phone: "62811",
        boundByPhone: true,
      }),
    ).toMatchObject({ email: "" });
  });
});
