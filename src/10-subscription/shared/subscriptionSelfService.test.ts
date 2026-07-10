import { describe, expect, it } from "vitest";
import { isAllowedWhenExpired } from "@/10-subscription/shared/subscriptionExpiryPolicy";
import {
  isSubscriptionModulePath,
  isSubscriptionSelfServiceEnabled,
} from "@/10-subscription/shared/subscriptionSelfService";

describe("subscriptionSelfService", () => {
  it("treats undefined/null as self-service enabled", () => {
    expect(isSubscriptionSelfServiceEnabled(undefined)).toBe(true);
    expect(isSubscriptionSelfServiceEnabled(null)).toBe(true);
    expect(isSubscriptionSelfServiceEnabled(true)).toBe(true);
    expect(isSubscriptionSelfServiceEnabled(false)).toBe(false);
  });

  it("matches subscription module paths", () => {
    expect(isSubscriptionModulePath("/subscription")).toBe(true);
    expect(isSubscriptionModulePath("/subscription/plans")).toBe(true);
    expect(isSubscriptionModulePath("/subscription/management/extra")).toBe(true);
    expect(isSubscriptionModulePath("/employees")).toBe(false);
  });
});

describe("isAllowedWhenExpired", () => {
  it("allows renewal routes for self-service tenants", () => {
    expect(isAllowedWhenExpired("/subscription/plans")).toBe(true);
    expect(isAllowedWhenExpired("/subscription/management")).toBe(true);
  });

  it("blocks renewal routes for sales tenants", () => {
    expect(
      isAllowedWhenExpired("/subscription/plans", { subscriptionSelfServiceEnabled: false }),
    ).toBe(false);
    expect(
      isAllowedWhenExpired("/subscription/management", { subscriptionSelfServiceEnabled: false }),
    ).toBe(false);
  });

  it("still allows auth routes for sales tenants", () => {
    expect(isAllowedWhenExpired("/login", { subscriptionSelfServiceEnabled: false })).toBe(true);
  });
});
