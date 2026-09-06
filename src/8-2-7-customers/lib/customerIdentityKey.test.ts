import { describe, expect, it } from "vitest";
import { resolveCustomerIdentityKey } from "./customerIdentityKey";

describe("resolveCustomerIdentityKey", () => {
  it("prefers phone over email", () => {
    const key = resolveCustomerIdentityKey({
      phone: "081234567890",
      email: "a@b.com",
    });
    expect(key).toEqual({
      kind: "phone",
      id: "phone:6281234567890",
      phoneKey: "6281234567890",
      emailKey: "a@b.com",
    });
  });

  it("falls back to email when phone missing", () => {
    const key = resolveCustomerIdentityKey({
      phone: null,
      email: "Octa@Mail.com",
    });
    expect(key).toEqual({
      kind: "email",
      id: "email:octa@mail.com",
      phoneKey: null,
      emailKey: "octa@mail.com",
    });
  });

  it("returns null when neither phone nor email", () => {
    expect(resolveCustomerIdentityKey({ phone: null, email: null })).toBeNull();
    expect(resolveCustomerIdentityKey({ phone: "Walk-in", email: "" })).toBeNull();
  });
});
