import { describe, expect, it } from "vitest";
import { generatePublicCode, isValidPublicCode, normalizePublicCode } from "./publicCode";

describe("publicCode", () => {
  it("accepts 6 lowercase alphanumeric characters", () => {
    expect(isValidPublicCode("kremlin".slice(0, 6))).toBe(true);
    expect(isValidPublicCode("ab12cd")).toBe(true);
    expect(isValidPublicCode("AB12CD")).toBe(false);
    expect(isValidPublicCode("short")).toBe(false);
    expect(isValidPublicCode("toolong1")).toBe(false);
  });

  it("normalizes to lowercase trim", () => {
    expect(normalizePublicCode("  Ab12Cd  ")).toBe("ab12cd");
  });

  it("generates a valid 6-char code", () => {
    const code = generatePublicCode(() => 0.1);
    expect(isValidPublicCode(code)).toBe(true);
    expect(code).toHaveLength(6);
  });
});
