import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECOVERY_CODE_COUNT,
  MIN_RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
} from "./recoveryCodes";

describe("generateRecoveryCodes", () => {
  it("issues at least 8 unique formatted codes by default", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(DEFAULT_RECOVERY_CODE_COUNT);
    expect(codes.length).toBeGreaterThanOrEqual(MIN_RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });

  it("never returns fewer than the minimum count", () => {
    const codes = generateRecoveryCodes(3);
    expect(codes.length).toBeGreaterThanOrEqual(MIN_RECOVERY_CODE_COUNT);
  });
});
