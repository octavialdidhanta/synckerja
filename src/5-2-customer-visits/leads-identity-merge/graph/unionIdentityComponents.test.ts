import { describe, expect, it } from "vitest";
import { buildIdentityLeadKeys } from "./buildIdentityKeyNodes";
import { buildIdentityBridgeEdges } from "./buildIdentityBridgeEdges";
import { unionIdentityComponents } from "./unionIdentityComponents";
import { planIdentityComponentMerge } from "./planIdentityComponentMerge";
import type { LeadMergeLeadInput } from "../types";

function lead(
  partial: Partial<LeadMergeLeadInput> & Pick<LeadMergeLeadInput, "id">,
): LeadMergeLeadInput {
  return {
    client: "Walk-in",
    phone_number: null,
    email: null,
    source: "POS",
    ticket_id: `pos-${partial.id}`,
    updated_at: "2026-09-01T00:00:00.000Z",
    created_at: "2026-09-01T00:00:00.000Z",
    merged_into_lead_id: null,
    ...partial,
  };
}

describe("unionIdentityComponents", () => {
  it("keeps phone-only and email-only separate without bridge", () => {
    const leads = [
      lead({ id: "p", phone_number: "081234567890", client: "A" }),
      lead({ id: "e", email: "a@mail.com", client: "A" }),
    ];
    const keys = buildIdentityLeadKeys(leads);
    const components = unionIdentityComponents(keys, buildIdentityBridgeEdges(keys));
    expect(components).toHaveLength(2);
  });

  it("unions phone-only + email-only when a bridge lead has both", () => {
    const leads = [
      lead({ id: "p", phone_number: "081234567890", client: "Phone" }),
      lead({ id: "e", email: "a@mail.com", client: "Email" }),
      lead({
        id: "bridge",
        phone_number: "6281234567890",
        email: "a@mail.com",
        client: "Both",
        source: "Lead Magnet",
        ticket_id: "LEAD-1",
      }),
    ];
    const keys = buildIdentityLeadKeys(leads);
    const components = unionIdentityComponents(keys, buildIdentityBridgeEdges(keys));
    expect(components).toHaveLength(1);
    expect(components[0]?.leadIds.sort()).toEqual(["bridge", "e", "p"]);

    const byId = new Map(leads.map((l) => [l.id, l]));
    const plan = planIdentityComponentMerge(components[0]!, byId);
    expect(plan.skipped).toBe(false);
    if (!plan.skipped) {
      expect(plan.winnerLeadId).toBe("bridge");
    }
  });
});
