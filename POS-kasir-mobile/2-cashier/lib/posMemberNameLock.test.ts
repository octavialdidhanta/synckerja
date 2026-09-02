import { describe, expect, it } from "vitest";
import { shouldLockPosMemberName } from "./posMemberNameLock";

describe("shouldLockPosMemberName", () => {
  it("locks a personal CRM name", () => {
    expect(shouldLockPosMemberName("Octa Vialdi")).toBe(true);
    expect(shouldLockPosMemberName("vialdi.id")).toBe(true);
  });

  it("unlocks generic or empty names so POS can fill them", () => {
    expect(shouldLockPosMemberName("Walk-in")).toBe(false);
    expect(shouldLockPosMemberName("walk in")).toBe(false);
    expect(shouldLockPosMemberName("")).toBe(false);
    expect(shouldLockPosMemberName(null)).toBe(false);
    expect(shouldLockPosMemberName("—")).toBe(false);
  });
});
