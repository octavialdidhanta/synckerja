import { describe, expect, it } from "vitest";
import { hydratePosBillCustomer } from "./hydratePosBillCustomer";

describe("hydratePosBillCustomer", () => {
  it("keeps a name-only guest as session-only without a lead", () => {
    expect(
      hydratePosBillCustomer({
        sessionName: "Linda",
        sessionPhone: "",
        lead: null,
      }),
    ).toEqual({
      leadId: null,
      name: "Linda",
      phone: "",
      boundByPhone: false,
    });
  });

  it("replaces a session nickname with the CRM personal name for the same HP", () => {
    expect(
      hydratePosBillCustomer({
        sessionName: "Linda",
        sessionPhone: "081281714855",
        lead: {
          id: "lead-octa",
          client: "Octa Vialdi",
          phone_number: "6281281714855",
        },
      }),
    ).toEqual({
      leadId: "lead-octa",
      name: "Octa Vialdi",
      phone: "6281281714855",
      boundByPhone: true,
    });
  });

  it("keeps session text when the HP is not in CRM", () => {
    expect(
      hydratePosBillCustomer({
        sessionName: "Linda",
        sessionPhone: "081200000000",
        lead: null,
      }),
    ).toEqual({
      leadId: null,
      name: "Linda",
      phone: "081200000000",
      boundByPhone: false,
    });
  });

  it("returns null when the session has no guest fields", () => {
    expect(
      hydratePosBillCustomer({
        sessionName: "",
        sessionPhone: "",
        lead: null,
      }),
    ).toBeNull();
  });
});
