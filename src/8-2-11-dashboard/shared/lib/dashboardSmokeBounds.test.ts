import { describe, expect, it } from "vitest";
import { salesSummaryRangeToTimestamps } from "@/8-2-10-reports/sales-summary/lib/salesSummaryDatePresets";
import { averageSalePerTransaction } from "./dashboardMetricFormat";

describe("dashboard smoke bounds (WIB all-day)", () => {
  it("maps Today to exclusive next-day bound like Reports", () => {
    const ts = salesSummaryRangeToTimestamps({
      fromYmd: "2026-09-05",
      toYmd: "2026-09-05",
      allDay: true,
      startTime: "00:00",
      endTime: "23:59",
    });
    expect(ts.fromIso).toBe("2026-09-05T00:00:00+07:00");
    expect(ts.toIso).toBe("2026-09-06T00:00:00+07:00");
  });

  it("maps this month September 2026 to exclusive Oct 1", () => {
    const ts = salesSummaryRangeToTimestamps({
      fromYmd: "2026-09-01",
      toYmd: "2026-09-30",
      allDay: true,
      startTime: "00:00",
      endTime: "23:59",
    });
    expect(ts.fromIso).toBe("2026-09-01T00:00:00+07:00");
    expect(ts.toIso).toBe("2026-10-01T00:00:00+07:00");
  });

  it("matches live RPC avg sale for known month totals", () => {
    // From smoke: net 649000 / txn 18
    expect(averageSalePerTransaction(649_000, 18)).toBeCloseTo(649_000 / 18, 5);
    expect(averageSalePerTransaction(466_000, 0)).toBe(0);
  });
});
