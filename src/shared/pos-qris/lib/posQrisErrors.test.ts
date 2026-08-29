import { describe, expect, it } from "vitest";
import { mapPosQrisErrorKey } from "./posQrisErrors";

describe("mapPosQrisErrorKey", () => {
  it("maps known server codes to i18n keys", () => {
    expect(mapPosQrisErrorKey(new Error("pos_qris_amount_too_low"))).toBe(
      "pos.payment.qris.errors.amountTooLow",
    );
    expect(mapPosQrisErrorKey(new Error("pos_qris_pending_exists"))).toBe(
      "pos.payment.qris.errors.pendingExists",
    );
  });

  it("falls back to generic key", () => {
    expect(mapPosQrisErrorKey(new Error("something_else"))).toBe(
      "pos.payment.qris.errors.generic",
    );
  });
});
