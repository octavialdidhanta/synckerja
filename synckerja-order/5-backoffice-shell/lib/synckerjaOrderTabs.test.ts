import { describe, expect, it } from "vitest";
import {
  synckerjaOrderTabFromPathname,
  synckerjaOrderTabPath,
} from "./synckerjaOrderTabs";

describe("synckerjaOrderTabFromPathname", () => {
  it("maps each tab path without falling back to profile", () => {
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order")).toBe("profile");
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order/profile")).toBe("profile");
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order/contact")).toBe("contact");
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order/terms")).toBe("terms");
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order/outlets")).toBe("outlets");
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order/hours")).toBe("hours");
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order/catalog")).toBe("catalog");
    expect(synckerjaOrderTabFromPathname("/operations/synckerja-order/qr")).toBe("qr");
  });

  it("round-trips tab ids to paths", () => {
    expect(synckerjaOrderTabFromPathname(synckerjaOrderTabPath("outlets"))).toBe("outlets");
    expect(synckerjaOrderTabFromPathname(synckerjaOrderTabPath("hours"))).toBe("hours");
    expect(synckerjaOrderTabFromPathname(synckerjaOrderTabPath("catalog"))).toBe("catalog");
  });
});
