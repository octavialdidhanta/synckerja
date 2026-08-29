import { describe, expect, it } from "vitest";
import { derivePosQrisSettingsStatus } from "./posQrisSettingsStatus";

describe("derivePosQrisSettingsStatus", () => {
  it("returns ready when eligible", () => {
    const s = derivePosQrisSettingsStatus({
      isLoading: false,
      xenditEnabled: true,
      hasSubAccount: true,
      hasQrisChannel: true,
      isEligible: true,
    });
    expect(s.code).toBe("ready");
    expect(s.tone).toBe("success");
  });

  it("prioritizes xendit off", () => {
    const s = derivePosQrisSettingsStatus({
      isLoading: false,
      xenditEnabled: false,
      hasSubAccount: false,
      hasQrisChannel: false,
      isEligible: false,
    });
    expect(s.code).toBe("xendit_off");
  });

  it("returns channel inactive when xendit ok but no channel", () => {
    const s = derivePosQrisSettingsStatus({
      isLoading: false,
      xenditEnabled: true,
      hasSubAccount: true,
      hasQrisChannel: false,
      isEligible: false,
    });
    expect(s.code).toBe("channel_inactive");
  });
});
