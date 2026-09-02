import { describe, expect, it } from "vitest";
import { buildCashierQrPayload, parseCashierQrPayload } from "./buildCashierQrPayload";

describe("buildCashierQrPayload", () => {
  it("wraps token with SYNK prefix", () => {
    expect(buildCashierQrPayload("abc1234567")).toBe("SYNK:ABC1234567");
  });

  it("parses scanner input", () => {
    expect(parseCashierQrPayload("SYNK:ABC1234567")).toBe("ABC1234567");
    expect(parseCashierQrPayload("synk:abc1234567")).toBe("ABC1234567");
    expect(parseCashierQrPayload("INVALID")).toBeNull();
    expect(parseCashierQrPayload("SYNK:SHORT")).toBeNull();
  });
});
