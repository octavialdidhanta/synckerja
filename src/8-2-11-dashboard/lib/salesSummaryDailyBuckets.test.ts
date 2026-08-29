import { describe, expect, it } from "vitest";

/** Mirror of WIB day bucket used by pos_sales_summary_daily (Asia/Jakarta). */
function wibDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

describe("sales summary daily WIB buckets", () => {
  it("buckets late WIB evening on the same calendar day", () => {
    // 2026-08-26 23:30 WIB = 2026-08-26 16:30 UTC
    expect(wibDateKey("2026-08-26T16:30:00.000Z")).toBe("2026-08-26");
  });

  it("buckets just after midnight WIB on the next calendar day", () => {
    // 2026-08-27 00:15 WIB = 2026-08-26 17:15 UTC
    expect(wibDateKey("2026-08-26T17:15:00.000Z")).toBe("2026-08-27");
  });

  it("keeps refunded_at day independent from created_at day", () => {
    const saleDay = wibDateKey("2026-08-25T10:00:00.000Z");
    const refundDay = wibDateKey("2026-08-26T10:00:00.000Z");
    expect(saleDay).toBe("2026-08-25");
    expect(refundDay).toBe("2026-08-26");
    expect(saleDay).not.toBe(refundDay);
  });
});
