import { describe, expect, it } from "vitest";
import {
  bundledLeadMagnetFromSelections,
  isFlatPerOrganizationAddOn,
  LEAD_MAGNET_ADD_ON_CODE,
} from "@/10-subscription/shared/subscriptionUtils";

describe("lead magnet add-on utils", () => {
  it("detects flat per-organization billing unit", () => {
    expect(isFlatPerOrganizationAddOn("per_organization_month")).toBe(true);
    expect(isFlatPerOrganizationAddOn("per_roster_staff_month")).toBe(false);
  });

  it("bundledLeadMagnetFromSelections returns true when included", () => {
    expect(
      bundledLeadMagnetFromSelections({
        [LEAD_MAGNET_ADD_ON_CODE]: { included: true, quantity: 1 },
      }),
    ).toBe(true);
    expect(
      bundledLeadMagnetFromSelections({
        [LEAD_MAGNET_ADD_ON_CODE]: { included: false, quantity: 1 },
      }),
    ).toBe(false);
  });
});
