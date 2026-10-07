import { describe, expect, it } from "vitest";
import { formatMetaAdsFunnelReportTitle } from "@/meta-ads/lib/formatMetaAdsFunnelReportTitle";

describe("formatMetaAdsFunnelReportTitle", () => {
  it("uses the account name and the filtered month range", () => {
    expect(
      formatMetaAdsFunnelReportTitle("RAPA TECH", {
        preset: "this_month",
        rollingDays: 30,
        range: {
          from: new Date(2026, 9, 1),
          to: new Date(2026, 9, 7, 23, 59),
        },
      }),
    ).toBe("META CPAS - RAPA TECH - This month 1 Oct 2026 - 7 Oct 2026");
  });

  it("does not repeat the brand when the account label already starts with it", () => {
    expect(
      formatMetaAdsFunnelReportTitle("META CPAS - RAPA TECH", {
        preset: "this_month",
        rollingDays: 30,
        range: {
          from: new Date(2026, 9, 1),
          to: new Date(2026, 9, 7, 23, 59),
        },
      }),
    ).toBe("META CPAS - RAPA TECH - This month 1 Oct 2026 - 7 Oct 2026");
  });

  it("keeps a single date when the filter is one day", () => {
    expect(
      formatMetaAdsFunnelReportTitle("RAPA TECH", {
        preset: "today",
        rollingDays: 30,
        range: {
          from: new Date(2026, 9, 7),
          to: new Date(2026, 9, 7, 23, 59),
        },
      }),
    ).toBe("META CPAS - RAPA TECH - Today 7 Oct 2026");
  });
});
