import { describe, expect, it } from "vitest";
import {
  POS_CHECKOUT_CRITICAL_PHASES,
  POS_CHECKOUT_SIDE_EFFECT_PHASES,
} from "./posCheckoutPhases";

describe("posCheckoutPhases", () => {
  it("keeps Bluetooth print off the critical path", () => {
    expect(POS_CHECKOUT_CRITICAL_PHASES).not.toContain("kitchen_ticket_print");
    expect(POS_CHECKOUT_CRITICAL_PHASES).not.toContain("receipt_print");
    expect(POS_CHECKOUT_SIDE_EFFECT_PHASES).toEqual([
      "kitchen_ticket_print",
      "receipt_print",
    ]);
  });

  it("keeps money, seating, and KDS ticket insert on the critical path", () => {
    expect(POS_CHECKOUT_CRITICAL_PHASES).toContain("shift_stock_lead_activity_income");
    expect(POS_CHECKOUT_CRITICAL_PHASES).toContain("pay_first_session_insert");
    expect(POS_CHECKOUT_CRITICAL_PHASES).toContain("kitchen_ticket_insert");
    expect(POS_CHECKOUT_CRITICAL_PHASES).toContain("session_close_or_update");
    expect(POS_CHECKOUT_CRITICAL_PHASES).toContain("auto_done_existing_tickets");
  });
});
