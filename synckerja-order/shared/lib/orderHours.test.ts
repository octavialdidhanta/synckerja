import { describe, expect, it } from "vitest";
import {
  defaultWeeklyHours,
  evaluateOrderHours,
  normalizeWeeklyHours,
  orderHoursBadge,
} from "./orderHours";

function atWib(isoUtc: string): Date {
  return new Date(isoUtc);
}

describe("normalizeWeeklyHours", () => {
  it("defaults 11:00–22:00 for seven days", () => {
    const hours = defaultWeeklyHours();
    expect(hours).toHaveLength(7);
    expect(hours.map((row) => row.dow)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(hours.every((row) => row.open === "11:00" && row.close === "22:00" && !row.closed)).toBe(
      true,
    );
    expect(normalizeWeeklyHours(null)).toEqual(hours);
  });
});

describe("evaluateOrderHours", () => {
  const weekday = defaultWeeklyHours();

  it("is open Wednesday 15:00 with 11–22", () => {
    const state = evaluateOrderHours({
      weeklyHours: weekday,
      at: atWib("2026-04-15T08:00:00.000Z"),
    });
    expect(state.isOpen).toBe(true);
    expect(state.closeHhmm).toBe("22:00");
  });

  it("is closed Wednesday 22:30 and next open is Thursday 11:00", () => {
    const state = evaluateOrderHours({
      weeklyHours: weekday,
      at: atWib("2026-04-15T15:30:00.000Z"),
    });
    expect(state.isOpen).toBe(false);
    expect(state.nextOpenIsToday).toBe(false);
    expect(state.nextOpenHhmm).toBe("11:00");
    expect(state.nextOpenDow).toBe(4);
  });

  it("respects Saturday closed all day", () => {
    const hours = defaultWeeklyHours().map((row) =>
      row.dow === 6 ? { ...row, closed: true } : row,
    );
    const state = evaluateOrderHours({
      weeklyHours: hours,
      at: atWib("2026-04-18T08:00:00.000Z"),
    });
    expect(state.isOpen).toBe(false);
    expect(state.nextOpenDow).toBe(7);
    expect(state.nextOpenHhmm).toBe("11:00");
  });

  it("supports overnight 22:00–02:00", () => {
    const hours = defaultWeeklyHours().map((row) => ({
      ...row,
      open: "22:00",
      close: "02:00",
    }));
    expect(
      evaluateOrderHours({ weeklyHours: hours, at: atWib("2026-04-15T16:00:00.000Z") }).isOpen,
    ).toBe(true);
    expect(
      evaluateOrderHours({ weeklyHours: hours, at: atWib("2026-04-15T18:30:00.000Z") }).isOpen,
    ).toBe(true);
    expect(
      evaluateOrderHours({ weeklyHours: hours, at: atWib("2026-04-15T20:00:00.000Z") }).isOpen,
    ).toBe(false);
  });

  it("force_closed always closed", () => {
    const state = evaluateOrderHours({
      weeklyHours: weekday,
      forceClosed: true,
      at: atWib("2026-04-15T08:00:00.000Z"),
    });
    expect(state.isOpen).toBe(false);
    expect(state.forceClosed).toBe(true);
    expect(state.nextOpenHhmm).toBe("11:00");
  });
});

describe("orderHoursBadge", () => {
  it("labels open, closed today, and later", () => {
    expect(orderHoursBadge({ isOpen: true, closeHhmm: "22:00", nextOpenHhmm: null, nextOpenIsToday: false })).toEqual({
      kind: "open",
      time: "22:00",
    });
    expect(
      orderHoursBadge({ isOpen: false, closeHhmm: null, nextOpenHhmm: "11:00", nextOpenIsToday: true }),
    ).toEqual({ kind: "closedToday", time: "11:00" });
    expect(
      orderHoursBadge({ isOpen: false, closeHhmm: null, nextOpenHhmm: "11:00", nextOpenIsToday: false }),
    ).toEqual({ kind: "closedLater", time: "11:00" });
  });
});
