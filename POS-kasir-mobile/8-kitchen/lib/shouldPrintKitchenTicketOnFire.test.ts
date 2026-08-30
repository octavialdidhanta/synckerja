import { describe, expect, it } from "vitest";
import { shouldPrintKitchenTicketOnFire } from "./shouldPrintKitchenTicketOnFire";

describe("shouldPrintKitchenTicketOnFire", () => {
  it("prints on pay only when print-on-pay is on", () => {
    expect(shouldPrintKitchenTicketOnFire("on_pay", true)).toBe(true);
    expect(shouldPrintKitchenTicketOnFire("on_pay", false)).toBe(false);
  });

  it("prints on save bill when print-on-pay is off", () => {
    expect(shouldPrintKitchenTicketOnFire("save_bill", false)).toBe(true);
    expect(shouldPrintKitchenTicketOnFire("save_bill", true)).toBe(false);
  });
});
