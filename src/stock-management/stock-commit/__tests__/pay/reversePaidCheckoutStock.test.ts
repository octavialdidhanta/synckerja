import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/5-2-customer-visits/checkout/lib/createStoreCheckoutSalesActivity", () => ({
  rollbackStoreCheckoutSalesActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../rpc/applyCatalogStockReserve", () => ({
  reverseStoreCheckoutStock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../rpc/applyCatalogKitchenCommitStock", () => ({
  reverseCatalogKitchenCommit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/resolveStockCommitPolicy", () => ({
  resolveStockCommitPolicy: vi.fn().mockResolvedValue("kitchen"),
}));

import { rollbackStoreCheckoutSalesActivity } from "@/5-2-customer-visits/checkout/lib/createStoreCheckoutSalesActivity";
import { reverseStoreCheckoutStock } from "../../rpc/applyCatalogStockReserve";
import { reverseCatalogKitchenCommit } from "../../rpc/applyCatalogKitchenCommitStock";
import { reversePaidCheckoutStock } from "../../lib/pay/reversePaidCheckoutStock";

describe("reversePaidCheckoutStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when activityId missing", async () => {
    await expect(
      reversePaidCheckoutStock({
        organizationId: "org-1",
        activityId: "",
      }),
    ).rejects.toThrow("pos_refund_activity_required");
  });

  it("reverses checkout and kitchen when session kitchen mode", async () => {
    const result = await reversePaidCheckoutStock({
      organizationId: "org-1",
      activityId: "act-1",
      sessionId: "sess-1",
      outletId: "out-1",
      reverseId: "rev-1",
    });
    expect(reverseStoreCheckoutStock).toHaveBeenCalled();
    expect(reverseCatalogKitchenCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "sess-1",
        reverseId: "rev-1-kitchen",
        lines: null,
      }),
    );
    expect(rollbackStoreCheckoutSalesActivity).toHaveBeenCalledWith("act-1");
    expect(result.kitchenReversed).toBe(true);
    expect(result.stockReversed).toBe(true);
  });

  it("skips kitchen when no sessionId", async () => {
    const result = await reversePaidCheckoutStock({
      organizationId: "org-1",
      activityId: "act-2",
    });
    expect(reverseCatalogKitchenCommit).not.toHaveBeenCalled();
    expect(result.kitchenReversed).toBe(false);
  });

  it("skipStockReverse does not call reverse RPCs", async () => {
    const result = await reversePaidCheckoutStock({
      organizationId: "org-1",
      activityId: "act-3",
      sessionId: "sess-1",
      outletId: "out-1",
      skipStockReverse: true,
      rollbackActivity: false,
    });
    expect(reverseStoreCheckoutStock).not.toHaveBeenCalled();
    expect(reverseCatalogKitchenCommit).not.toHaveBeenCalled();
    expect(rollbackStoreCheckoutSalesActivity).not.toHaveBeenCalled();
    expect(result.stockReversed).toBe(false);
    expect(result.kitchenReversed).toBe(false);
    expect(result.activityRolledBack).toBe(false);
  });
});
