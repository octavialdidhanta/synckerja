import { describe, expect, it } from "vitest";
import { payrollDuplicateMessage } from "./payrollDuplicateError";

describe("payrollDuplicateMessage", () => {
  it("explains a duplicate period", () => {
    expect(payrollDuplicateMessage({ code: "23505" }, "period")).toMatch(/tanggal yang sama/);
  });

  it("explains a second run on the same period", () => {
    expect(payrollDuplicateMessage({ code: "23505" }, "run")).toMatch(/sudah punya payroll run/);
  });

  it("leaves other database errors to the caller", () => {
    expect(payrollDuplicateMessage({ code: "42501", message: "forbidden" }, "period")).toBeNull();
    expect(payrollDuplicateMessage(null, "run")).toBeNull();
  });
});
