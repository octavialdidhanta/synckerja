import { describe, expect, it } from "vitest";
import { isExpiredAuthError, isSessionAccessTokenExpired } from "./expiredAuth";

describe("isExpiredAuthError", () => {
  it("matches supabase auth and postgrest expired-token payloads", () => {
    expect(isExpiredAuthError({ code: "bad_jwt", message: "token is expired" })).toBe(true);
    expect(
      isExpiredAuthError({
        message: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired",
      }),
    ).toBe(true);
    expect(isExpiredAuthError({ code: "PGRST303", message: "JWT expired" })).toBe(true);
    expect(isExpiredAuthError({ status: 403, message: "JWT expired" })).toBe(true);
    expect(isExpiredAuthError({ message: "Invalid Refresh Token" })).toBe(false);
  });
});

describe("isSessionAccessTokenExpired", () => {
  it("treats expires_at in the past as expired", () => {
    expect(isSessionAccessTokenExpired({ expires_at: 1_700_000_000 }, 1_800_000_000_000)).toBe(true);
    expect(isSessionAccessTokenExpired({ expires_at: 1_900_000_000 }, 1_800_000_000_000)).toBe(false);
    expect(isSessionAccessTokenExpired(null)).toBe(false);
  });
});
