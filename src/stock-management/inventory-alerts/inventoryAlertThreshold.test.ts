import { describe, expect, it } from "vitest";
import {
  didCrossInventoryAlertThreshold,
  inventoryAlertStatusFromStock,
} from "./inventoryAlertThreshold";

describe("inventoryAlertStatusFromStock", () => {
  it("returns out when qty <= 0", () => {
    expect(
      inventoryAlertStatusFromStock({
        inStock: 0,
        alertEnabled: false,
        alertAt: null,
      }),
    ).toBe("out");
  });

  it("returns low when alert enabled and qty <= alertAt", () => {
    expect(
      inventoryAlertStatusFromStock({
        inStock: 2,
        alertEnabled: true,
        alertAt: 5,
      }),
    ).toBe("low");
  });

  it("returns null when healthy", () => {
    expect(
      inventoryAlertStatusFromStock({
        inStock: 10,
        alertEnabled: true,
        alertAt: 5,
      }),
    ).toBeNull();
  });
});

describe("didCrossInventoryAlertThreshold", () => {
  it("fires out on transition into zero", () => {
    expect(
      didCrossInventoryAlertThreshold({
        prevInStock: 3,
        nextInStock: 0,
        alertEnabled: true,
        alertAt: 5,
      }),
    ).toBe("out");
  });

  it("fires low on transition into low band", () => {
    expect(
      didCrossInventoryAlertThreshold({
        prevInStock: 10,
        nextInStock: 4,
        alertEnabled: true,
        alertAt: 5,
      }),
    ).toBe("low");
  });

  it("does not re-fire while staying low", () => {
    expect(
      didCrossInventoryAlertThreshold({
        prevInStock: 4,
        nextInStock: 3,
        alertEnabled: true,
        alertAt: 5,
      }),
    ).toBeNull();
  });

  it("does not fire when alert disabled and still positive", () => {
    expect(
      didCrossInventoryAlertThreshold({
        prevInStock: 10,
        nextInStock: 1,
        alertEnabled: false,
        alertAt: 5,
      }),
    ).toBeNull();
  });
});
