import { describe, expect, it } from "vitest";
import { calculateOvertimePay } from "./overtimeFromAttendance";

describe("calculateOvertimePay with break duration", () => {
  const basicSalary = 15_000_000;

  it("extends scheduled end by break before counting overtime (shift)", () => {
    const result = calculateOvertimePay(basicSalary, [
      {
        checkInAt: "2026-05-20T08:00:00",
        checkOutAt: "2026-05-20T18:30:00",
        scheduledEndTime: "17:00",
        breakDurationMinutes: 60,
        scheduleSource: "shift",
      },
    ]);

    expect(result.totalMinutes).toBe(30);
  });

  it("ignores break for work_schedule source", () => {
    const result = calculateOvertimePay(basicSalary, [
      {
        checkInAt: "2026-05-20T08:00:00",
        checkOutAt: "2026-05-20T18:30:00",
        scheduledEndTime: "17:00",
        breakDurationMinutes: 60,
        scheduleSource: "work_schedule",
      },
    ]);

    expect(result.totalMinutes).toBe(90);
  });

  it("returns zero when checkout before extended end", () => {
    const result = calculateOvertimePay(basicSalary, [
      {
        checkInAt: "2026-05-20T08:00:00",
        checkOutAt: "2026-05-20T17:30:00",
        scheduledEndTime: "17:00",
        breakDurationMinutes: 60,
        scheduleSource: "shift",
      },
    ]);

    expect(result.totalMinutes).toBe(0);
  });
});
