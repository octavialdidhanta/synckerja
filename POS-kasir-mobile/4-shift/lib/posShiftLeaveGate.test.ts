import { describe, expect, it } from "vitest";
import {
  canUserEndOpenShift,
  shouldGateLeaveForOpenShift,
} from "./posShiftLeaveGate";

describe("pos shift leave gate", () => {
  it("should gate leave when open shift exists", () => {
    expect(shouldGateLeaveForOpenShift({ id: "s1" })).toBe(true);
    expect(shouldGateLeaveForOpenShift(null)).toBe(false);
  });

  it("allows opener or unrestricted to end", () => {
    expect(
      canUserEndOpenShift({
        openedBy: "u1",
        userId: "u1",
        unrestricted: false,
      }),
    ).toBe(true);
    expect(
      canUserEndOpenShift({
        openedBy: "u1",
        userId: "u2",
        unrestricted: true,
      }),
    ).toBe(true);
    expect(
      canUserEndOpenShift({
        openedBy: "u1",
        userId: "u2",
        unrestricted: false,
      }),
    ).toBe(false);
  });
});
