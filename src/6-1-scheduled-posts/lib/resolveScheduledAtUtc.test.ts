import { describe, expect, it } from "vitest";
import {
  formatTimeWibFromUtc,
  resolveScheduledAtUtc,
  scheduleTimeWibOrDefault,
} from "@/6-1-scheduled-posts/lib/resolveScheduledAtUtc";

describe("schedule time WIB", () => {
  it("round-trips 09:00 WIB into the time input format", () => {
    const iso = resolveScheduledAtUtc("2026-10-14", "09:00");
    expect(iso).toBeTruthy();
    expect(formatTimeWibFromUtc(iso!)).toBe("09:00");
    expect(scheduleTimeWibOrDefault(iso, "18:00")).toBe("09:00");
  });

  it("uses the org default only when there is no saved schedule", () => {
    expect(scheduleTimeWibOrDefault(null, "18:00")).toBe("18:00");
    expect(scheduleTimeWibOrDefault(undefined, "15:00")).toBe("15:00");
  });
});
