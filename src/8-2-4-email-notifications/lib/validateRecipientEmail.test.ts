import { describe, expect, it } from "vitest";
import {
  isValidRecipientEmail,
  mapOperationalEmailRpcError,
  normalizeRecipientEmail,
} from "./validateRecipientEmail";

describe("validateRecipientEmail", () => {
  it("normalizes email to lowercase trimmed", () => {
    expect(normalizeRecipientEmail("  Test@Example.COM ")).toBe("test@example.com");
  });

  it("accepts valid emails", () => {
    expect(isValidRecipientEmail("oktavialdidhanta@gmail.com")).toBe(true);
    expect(isValidRecipientEmail("user+tag@company.co.id")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidRecipientEmail("")).toBe(false);
    expect(isValidRecipientEmail("not-an-email")).toBe(false);
    expect(isValidRecipientEmail("@missing.com")).toBe(false);
  });

  it("maps rpc error codes from message", () => {
    expect(mapOperationalEmailRpcError("email_duplicate")).toBe("email_duplicate");
    expect(mapOperationalEmailRpcError("ERROR: token_expired")).toBe("token_expired");
    expect(mapOperationalEmailRpcError("something else")).toBeNull();
  });
});
