import { describe, expect, it } from "vitest";
import { isEmployeeEligibleForPayroll } from "./employeeUtils";

describe("isEmployeeEligibleForPayroll", () => {
  it("keeps an active human employee", () => {
    expect(
      isEmployeeEligibleForPayroll({
        employee_status_name: "active",
        is_ai: false,
      }),
    ).toBe(true);
  });

  it("excludes every AI employee, including an active one", () => {
    expect(
      isEmployeeEligibleForPayroll({
        employee_status_name: "active",
        is_ai: true,
      }),
    ).toBe(false);
  });

  it("still excludes a human employee pending removal", () => {
    expect(
      isEmployeeEligibleForPayroll({
        employee_status_name: "active",
        is_ai: false,
        pending_removal: true,
      }),
    ).toBe(false);
  });
});
