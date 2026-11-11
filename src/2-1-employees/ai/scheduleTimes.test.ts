import { describe, expect, it } from "vitest";
import { canAddScheduleTime, circularGapMinutes } from "./scheduleTimes";

describe("circularGapMinutes", () => {
  it("accepts exactly one hour", () => {
    expect(circularGapMinutes("09:00", "10:00")).toBe(60);
  });

  it("rejects fifty-nine minutes", () => {
    expect(circularGapMinutes("09:00", "09:59")).toBe(59);
  });

  it("measures across midnight", () => {
    expect(circularGapMinutes("23:30", "00:10")).toBe(40);
  });
});

describe("canAddScheduleTime", () => {
  it("keeps a time at least one hour away", () => {
    expect(canAddScheduleTime(["09:00"], "10:00")).toBe(true);
  });

  it("rejects a time inside the hour, a duplicate, and an eighth time", () => {
    expect(canAddScheduleTime(["09:00"], "09:30")).toBe(false);
    expect(canAddScheduleTime(["23:30"], "00:10")).toBe(false);
    expect(canAddScheduleTime(["09:00"], "09:00")).toBe(false);
    expect(canAddScheduleTime(["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"], "14:00")).toBe(false);
  });
});
