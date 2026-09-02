import { describe, expect, it } from "vitest";
import {
  canPublishToOrderOutlet,
  isHiddenForOrderOutlet,
  isOrderCatalogEligible,
  orphanOrderPublishOutletIds,
  planOrderCatalogPublish,
} from "./orderCatalogPublish";

describe("canPublishToOrderOutlet", () => {
  it("requires the selected outlet to be assigned", () => {
    expect(
      canPublishToOrderOutlet({ selectedOutletId: "a", assignedOutletIds: ["b", "a"] }),
    ).toBe(true);
    expect(
      canPublishToOrderOutlet({ selectedOutletId: "a", assignedOutletIds: ["b"] }),
    ).toBe(false);
    expect(
      canPublishToOrderOutlet({ selectedOutletId: null, assignedOutletIds: ["a"] }),
    ).toBe(false);
    expect(
      canPublishToOrderOutlet({ selectedOutletId: "  ", assignedOutletIds: ["  "] }),
    ).toBe(false);
  });
});

describe("isHiddenForOrderOutlet", () => {
  it("uses outlet override over master status", () => {
    expect(isHiddenForOrderOutlet({ masterPosStatus: "available", outletPosStatus: "hidden" })).toBe(
      true,
    );
    expect(isHiddenForOrderOutlet({ masterPosStatus: "hidden", outletPosStatus: "available" })).toBe(
      false,
    );
    expect(isHiddenForOrderOutlet({ masterPosStatus: "hidden", outletPosStatus: null })).toBe(true);
    expect(isHiddenForOrderOutlet({ masterPosStatus: "sold_out", outletPosStatus: null })).toBe(
      false,
    );
  });
});

describe("isOrderCatalogEligible", () => {
  it("requires assignment and a non-hidden effective status", () => {
    expect(
      isOrderCatalogEligible({
        outletId: "a",
        assignedOutletIds: ["a"],
        masterPosStatus: "available",
        outletPosStatus: null,
      }),
    ).toBe(true);
    expect(
      isOrderCatalogEligible({
        outletId: "a",
        assignedOutletIds: ["b"],
        masterPosStatus: "available",
        outletPosStatus: null,
      }),
    ).toBe(false);
    expect(
      isOrderCatalogEligible({
        outletId: "a",
        assignedOutletIds: ["a"],
        masterPosStatus: "available",
        outletPosStatus: "hidden",
      }),
    ).toBe(false);
  });
});

describe("planOrderCatalogPublish", () => {
  it("inserts when assigned, wanted, and not yet opted in", () => {
    expect(
      planOrderCatalogPublish({ assigned: true, wantPublish: true, currentlyOptedIn: false }),
    ).toBe("insert");
  });

  it("deletes when assigned but publish is off", () => {
    expect(
      planOrderCatalogPublish({ assigned: true, wantPublish: false, currentlyOptedIn: true }),
    ).toBe("delete");
  });

  it("treats unassigned as off even if the switch is on", () => {
    expect(
      planOrderCatalogPublish({ assigned: false, wantPublish: true, currentlyOptedIn: true }),
    ).toBe("delete");
    expect(
      planOrderCatalogPublish({ assigned: false, wantPublish: true, currentlyOptedIn: false }),
    ).toBe("noop");
  });

  it("noops when state already matches", () => {
    expect(
      planOrderCatalogPublish({ assigned: true, wantPublish: true, currentlyOptedIn: true }),
    ).toBe("noop");
    expect(
      planOrderCatalogPublish({ assigned: true, wantPublish: false, currentlyOptedIn: false }),
    ).toBe("noop");
  });
});

describe("orphanOrderPublishOutletIds", () => {
  it("returns opted-in outlets that are no longer assigned", () => {
    expect(
      orphanOrderPublishOutletIds({
        optedInOutletIds: ["a", "b", "c"],
        assignedOutletIds: ["a", "c"],
      }),
    ).toEqual(["b"]);
  });
});
