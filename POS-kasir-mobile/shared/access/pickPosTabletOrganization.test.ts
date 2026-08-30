import { describe, expect, it } from "vitest";
import { pickPosTabletOrganization } from "./pickPosTabletOrganization";

describe("pickPosTabletOrganization", () => {
  it("denies not_staff when no candidates", () => {
    expect(pickPosTabletOrganization("a", [])).toEqual({
      action: "deny",
      reason: "not_staff",
    });
  });

  it("denies addon_inactive when staff orgs have no add-on", () => {
    expect(
      pickPosTabletOrganization("test", [
        { organizationId: "office", addonActive: false },
      ]),
    ).toEqual({ action: "deny", reason: "addon_inactive" });
  });

  it("keeps current org when it has staff + add-on", () => {
    expect(
      pickPosTabletOrganization("office", [
        { organizationId: "office", addonActive: true },
        { organizationId: "test", addonActive: false },
      ]),
    ).toEqual({ action: "use", organizationId: "office" });
  });

  it("switches from Test (no staff/addon) to org with Kitchen staff + add-on", () => {
    expect(
      pickPosTabletOrganization("test", [
        { organizationId: "office", addonActive: true },
      ]),
    ).toEqual({ action: "switch", organizationId: "office" });
  });
});
