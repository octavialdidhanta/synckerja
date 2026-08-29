import { describe, expect, it } from "vitest";
import { resolvePosCashierDisplayName } from "./resolvePosCashierDisplayName";

describe("resolvePosCashierDisplayName", () => {
  it("prefers employees.full_name", () => {
    expect(
      resolvePosCashierDisplayName({
        employeeFullName: "OCTA VIALDI",
        profileFullName: "Octa",
        email: "octa@example.com",
      }),
    ).toBe("OCTA VIALDI");
  });

  it("falls back to profiles.full_name", () => {
    expect(
      resolvePosCashierDisplayName({
        employeeFullName: null,
        profileFullName: "Octa Vialdi",
        email: "octa@example.com",
      }),
    ).toBe("Octa Vialdi");
  });

  it("falls back to email local-part", () => {
    expect(
      resolvePosCashierDisplayName({
        employeeFullName: "  ",
        profileFullName: null,
        email: "kasir@synckerja.com",
      }),
    ).toBe("kasir");
  });

  it("returns dash when empty", () => {
    expect(resolvePosCashierDisplayName({})).toBe("—");
  });
});
