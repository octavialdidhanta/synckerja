import { describe, expect, it } from "vitest";
import { loyaltyOpenStateFromCashier, loyaltySkipResult } from "./posLoyaltyIdentity";
import type { PosCashierCustomer } from "./posCashierCustomer";

const bound: PosCashierCustomer = {
  leadId: "lead-octa",
  name: "Octa Vialdi",
  phone: "6281281714855",
  email: "octa@mail.com",
  boundByPhone: true,
};

describe("loyaltyOpenStateFromCashier", () => {
  it("prefills a bound member as already checked", () => {
    expect(loyaltyOpenStateFromCashier(bound)).toEqual({
      phoneLocal: "81281714855",
      customer: {
        id: "lead-octa",
        name: "Octa Vialdi",
        phone: "6281281714855",
        email: "octa@mail.com",
      },
      checked: true,
    });
  });

  it("does not treat a session-only guest as a found member", () => {
    expect(
      loyaltyOpenStateFromCashier({
        leadId: null,
        name: "Linda",
        phone: "",
        email: "",
        boundByPhone: false,
      }),
    ).toEqual({ phoneLocal: "", customer: null, checked: false });
  });

  it("prefills HP from the bill without marking checked when not bound", () => {
    expect(
      loyaltyOpenStateFromCashier({
        leadId: null,
        name: "Linda",
        phone: "081281714855",
        email: "",
        boundByPhone: false,
      }),
    ).toEqual({
      phoneLocal: "81281714855",
      customer: null,
      checked: false,
    });
  });
});

describe("loyaltySkipResult", () => {
  it("clears the reward and keeps the bill identity", () => {
    const bill = {
      id: "lead-octa",
      name: "Octa Vialdi",
      phone: "6281281714855",
      email: "octa@mail.com",
    };
    expect(loyaltySkipResult(bill)).toEqual({
      customer: bill,
      reward: null,
    });
  });
});
