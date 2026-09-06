import { describe, expect, it } from "vitest";
import { normalizeCustomerEmail } from "./normalizeCustomerEmail";

describe("normalizeCustomerEmail", () => {
  it("trims and lowercases valid emails", () => {
    expect(normalizeCustomerEmail("  Foo@Gmail.COM ")).toBe("foo@gmail.com");
  });

  it("returns null for empty or invalid", () => {
    expect(normalizeCustomerEmail(null)).toBeNull();
    expect(normalizeCustomerEmail("")).toBeNull();
    expect(normalizeCustomerEmail("not-an-email")).toBeNull();
    expect(normalizeCustomerEmail("a@b")).toBeNull();
  });
});
