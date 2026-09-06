import { describe, expect, it } from "vitest";
import type { LeadMergeLeadInput } from "../types";
import { planCheckoutIdentityBridge } from "./planCheckoutIdentityBridge";

function lead(partial: Partial<LeadMergeLeadInput> & { id: string }): LeadMergeLeadInput {
  return {
    client: partial.client ?? "Walk-in",
    phone_number: partial.phone_number ?? null,
    email: partial.email ?? null,
    source: partial.source ?? "POS",
    ticket_id: partial.ticket_id ?? `t-${partial.id}`,
    updated_at: partial.updated_at ?? "2026-01-02T00:00:00Z",
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    merged_into_lead_id: partial.merged_into_lead_id ?? null,
    id: partial.id,
  };
}

describe("planCheckoutIdentityBridge", () => {
  it("plans a merge preferring the phone-anchored lead", () => {
    const phoneLead = lead({
      id: "phone-octa",
      client: "Octa Vialdi",
      phone_number: "6281281714855",
      updated_at: "2025-01-01T00:00:00Z",
    });
    const emailLead = lead({
      id: "email-papa",
      client: "Octa",
      email: "papadhanta@gmail.com",
      updated_at: "2026-01-02T00:00:00Z",
    });
    const plan = planCheckoutIdentityBridge({ phoneLead, emailLead });
    expect(plan.skipped).toBe(false);
    if (plan.skipped) return;
    expect(plan.winnerLeadId).toBe("phone-octa");
    expect(plan.loserLeadIds).toEqual(["email-papa"]);
  });

  it("skips when both leads are attributed", () => {
    const phoneLead = lead({
      id: "a",
      phone_number: "628111111111",
      source: "Lead Magnet",
      ticket_id: "enroll-a",
    });
    const emailLead = lead({
      id: "b",
      email: "b@mail.com",
      source: "Lead Magnet",
      ticket_id: "enroll-b",
    });
    expect(
      planCheckoutIdentityBridge({
        phoneLead,
        emailLead,
        enrolledLeadIds: new Set(["a", "b"]),
      }),
    ).toMatchObject({
      skipped: true,
      skipReason: "ambiguous_attributed",
    });
  });

  it("skips same lead", () => {
    const row = lead({
      id: "same",
      phone_number: "628111",
      email: "a@b.com",
    });
    expect(planCheckoutIdentityBridge({ phoneLead: row, emailLead: row })).toMatchObject({
      skipped: true,
      skipReason: "same_lead",
    });
  });
});
