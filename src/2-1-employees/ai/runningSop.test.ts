import { describe, expect, it } from "vitest";
import { RUN_STALE_MS, runningSince } from "./runningSop";

describe("runningSince", () => {
  it("ignores runs started more than 15 minutes ago", () => {
    expect(RUN_STALE_MS).toBe(15 * 60 * 1000);
    expect(runningSince(new Date("2026-11-12T15:30:00.000Z"))).toBe("2026-11-12T15:15:00.000Z");
  });
});
