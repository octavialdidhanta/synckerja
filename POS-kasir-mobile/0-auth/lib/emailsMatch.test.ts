import { describe, expect, it } from "vitest";
import { emailsMatch } from "./emailsMatch";

describe("emailsMatch", () => {
  it("matches ignoring case and surrounding spaces", () => {
    expect(emailsMatch("  Ada@Example.com ", "ada@example.com")).toBe(true);
  });

  it("returns false for different emails", () => {
    expect(emailsMatch("a@example.com", "b@example.com")).toBe(false);
  });
});
