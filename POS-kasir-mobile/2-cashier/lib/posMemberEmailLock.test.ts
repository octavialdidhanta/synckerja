import { describe, expect, it } from "vitest";
import {
  resolvePosCheckoutEmailForCart,
  syncEmailFieldAfterMemberCheck,
} from "./posMemberEmailLock";

describe("resolvePosCheckoutEmailForCart", () => {
  it("prefers CRM email when locked", () => {
    expect(
      resolvePosCheckoutEmailForCart({
        crmEmail: "oktavialdidhanta@gmail.com",
        typedEmail: "papadhanta@gmail.com",
        lockCrmEmail: true,
      }),
    ).toBe("oktavialdidhanta@gmail.com");
  });

  it("prefers typed email when unlocked", () => {
    expect(
      resolvePosCheckoutEmailForCart({
        crmEmail: "old@mail.com",
        typedEmail: "new@mail.com",
        lockCrmEmail: false,
      }),
    ).toBe("new@mail.com");
  });

  it("falls back to CRM when typed empty", () => {
    expect(
      resolvePosCheckoutEmailForCart({
        crmEmail: "crm@mail.com",
        typedEmail: "",
        lockCrmEmail: false,
      }),
    ).toBe("crm@mail.com");
  });
});

describe("syncEmailFieldAfterMemberCheck", () => {
  it("forces CRM email when member name is personal/locked", () => {
    expect(
      syncEmailFieldAfterMemberCheck({
        crmEmail: "oktavialdidhanta@gmail.com",
        currentField: "papadhanta@gmail.com",
        memberName: "Octa Vialdi",
      }),
    ).toBe("oktavialdidhanta@gmail.com");
  });

  it("prefills empty field from CRM", () => {
    expect(
      syncEmailFieldAfterMemberCheck({
        crmEmail: "a@mail.com",
        currentField: "",
        memberName: "Walk-in",
      }),
    ).toBe("a@mail.com");
  });

  it("keeps cashier typed email for unlocked generic members", () => {
    expect(
      syncEmailFieldAfterMemberCheck({
        crmEmail: "crm@mail.com",
        currentField: "typed@mail.com",
        memberName: "Walk-in",
      }),
    ).toBe("typed@mail.com");
  });
});
