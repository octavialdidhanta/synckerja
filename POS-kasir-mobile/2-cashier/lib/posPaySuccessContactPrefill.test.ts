import { describe, expect, it } from "vitest";
import { posPaySuccessContactPrefill } from "./posPaySuccessContactPrefill";

describe("posPaySuccessContactPrefill", () => {
  it("prefills valid email and local phone digits", () => {
    expect(
      posPaySuccessContactPrefill({
        email: "oktavialdidhanta@gmail.com",
        phone: "6281281714855",
      }),
    ).toEqual({
      email: "oktavialdidhanta@gmail.com",
      phoneLocal: "81281714855",
    });
  });

  it("returns empty strings when contacts are missing", () => {
    expect(posPaySuccessContactPrefill({})).toEqual({
      email: "",
      phoneLocal: "",
    });
  });

  it("drops invalid email typos", () => {
    expect(
      posPaySuccessContactPrefill({
        email: "a@gmail.comsss",
        phone: "081200000000",
      }),
    ).toEqual({
      email: "",
      phoneLocal: "81200000000",
    });
  });
});
