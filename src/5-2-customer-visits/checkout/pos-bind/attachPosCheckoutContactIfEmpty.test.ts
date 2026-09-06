import { describe, expect, it } from "vitest";
import { attachPosCheckoutContactIfEmpty } from "./attachPosCheckoutContactIfEmpty";

describe("attachPosCheckoutContactIfEmpty", () => {
  it("fills email only when lead email is empty", () => {
    expect(
      attachPosCheckoutContactIfEmpty({
        existingPhone: "62811",
        existingEmail: null,
        emailKey: "a@mail.com",
      }),
    ).toEqual({ email: "a@mail.com" });
  });

  it("does not overwrite an existing email", () => {
    expect(
      attachPosCheckoutContactIfEmpty({
        existingPhone: "62811",
        existingEmail: "old@mail.com",
        emailKey: "new@mail.com",
      }),
    ).toEqual({});
  });

  it("fills phone only when lead phone is empty", () => {
    expect(
      attachPosCheckoutContactIfEmpty({
        existingPhone: null,
        existingEmail: "a@mail.com",
        phoneKey: "6281234567890",
      }),
    ).toEqual({ phone_number: "6281234567890" });
  });
});
