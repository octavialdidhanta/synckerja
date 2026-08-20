import { describe, expect, it } from "vitest";
import { matchesPromoListFilters, promoListStatus } from "./promoListStatus";

const now = new Date(2026, 7, 18, 11, 0, 0);

function period(overrides: {
  time_period_enabled?: boolean;
  starts_on?: string | null;
  ends_on?: string | null;
  starts_at_time?: string | null;
  ends_at_time?: string | null;
  name?: string;
}) {
  return {
    name: "Big Sale",
    time_period_enabled: true,
    starts_on: "2026-08-01",
    ends_on: "2026-08-31",
    starts_at_time: null,
    ends_at_time: null,
    ...overrides,
  };
}

describe("promoListStatus", () => {
  it("treats Always (no period) as ongoing", () => {
    expect(promoListStatus(period({ time_period_enabled: false }), now)).toBe("ongoing");
  });

  it("treats incomplete dates as ongoing", () => {
    expect(promoListStatus(period({ starts_on: null }), now)).toBe("ongoing");
    expect(promoListStatus(period({ ends_on: "" }), now)).toBe("ongoing");
    expect(promoListStatus(period({ starts_on: "bad", ends_on: "also-bad" }), now)).toBe("ongoing");
  });

  it("is scheduled when now is before start (no times)", () => {
    expect(
      promoListStatus(period({ starts_on: "2026-08-20", ends_on: "2026-08-31" }), now),
    ).toBe("scheduled");
  });

  it("is ongoing when now is inside the date range (no times)", () => {
    expect(
      promoListStatus(period({ starts_on: "2026-08-01", ends_on: "2026-08-31" }), now),
    ).toBe("ongoing");
  });

  it("is inactive when now is after the end date (no times)", () => {
    expect(
      promoListStatus(period({ starts_on: "2026-07-01", ends_on: "2026-08-17" }), now),
    ).toBe("inactive");
  });

  it("uses start/end times when set", () => {
    expect(
      promoListStatus(
        period({
          starts_on: "2026-08-18",
          ends_on: "2026-08-18",
          starts_at_time: "12:00",
          ends_at_time: "18:00",
        }),
        now,
      ),
    ).toBe("scheduled");
    expect(
      promoListStatus(
        period({
          starts_on: "2026-08-18",
          ends_on: "2026-08-18",
          starts_at_time: "09:00",
          ends_at_time: "18:00",
        }),
        now,
      ),
    ).toBe("ongoing");
    expect(
      promoListStatus(
        period({
          starts_on: "2026-08-18",
          ends_on: "2026-08-18",
          starts_at_time: "08:00",
          ends_at_time: "10:30",
        }),
        now,
      ),
    ).toBe("inactive");
  });
});

describe("matchesPromoListFilters", () => {
  it("filters by status and name", () => {
    const row = period({ name: "Weekend Discount" });
    expect(matchesPromoListFilters(row, { status: "all", query: "" }, now)).toBe(true);
    expect(matchesPromoListFilters(row, { status: "ongoing", query: "weekend" }, now)).toBe(true);
    expect(matchesPromoListFilters(row, { status: "scheduled", query: "" }, now)).toBe(false);
    expect(matchesPromoListFilters(row, { status: "all", query: "flash" }, now)).toBe(false);
  });
});
