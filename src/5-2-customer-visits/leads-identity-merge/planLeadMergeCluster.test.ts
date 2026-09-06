import { describe, expect, it } from "vitest";
import { planLeadMergeCluster } from "./planLeadMergeCluster";
import type { LeadMergeCluster, LeadMergeLeadInput } from "./types";

function lead(
  partial: Partial<LeadMergeLeadInput> & Pick<LeadMergeLeadInput, "id">,
): LeadMergeLeadInput {
  return {
    client: "Walk-in",
    phone_number: "6281234567890",
    email: null,
    source: "POS",
    ticket_id: `pos-walkin-${partial.id}`,
    updated_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    merged_into_lead_id: null,
    ...partial,
  };
}

function byId(leads: LeadMergeLeadInput[]): Map<string, LeadMergeLeadInput> {
  return new Map(leads.map((l) => [l.id, l]));
}

describe("planLeadMergeCluster", () => {
  const cluster: LeadMergeCluster = {
    kind: "phone",
    clusterKey: "6281234567890",
    leadIds: ["walk", "magnet"],
  };

  it("picks attributed Lead Magnet as winner over Walk-in", () => {
    const leads = [
      lead({ id: "walk", client: "Walk-in", updated_at: "2026-09-01T00:00:00.000Z" }),
      lead({
        id: "magnet",
        client: "Octa",
        source: "Lead Magnet",
        ticket_id: "LEAD-ABC",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const plan = planLeadMergeCluster(cluster, byId(leads));
    expect(plan.skipped).toBe(false);
    if (!plan.skipped) {
      expect(plan.winnerLeadId).toBe("magnet");
      expect(plan.loserLeadIds).toEqual(["walk"]);
    }
  });

  it("skips when two attributed leads share the key", () => {
    const leads = [
      lead({
        id: "a",
        source: "Lead Magnet",
        ticket_id: "LEAD-A",
      }),
      lead({
        id: "b",
        source: "Lead Magnet",
        ticket_id: "LEAD-B",
      }),
    ];
    const plan = planLeadMergeCluster(
      { ...cluster, leadIds: ["a", "b"] },
      byId(leads),
    );
    expect(plan).toMatchObject({
      skipped: true,
      skipReason: "ambiguous_attributed",
      winnerLeadId: null,
    });
  });

  it("prefers personal name when neither is attributed", () => {
    const leads = [
      lead({ id: "walk", client: "Walk-in", updated_at: "2026-09-01T00:00:00.000Z" }),
      lead({ id: "named", client: "Budi", updated_at: "2026-01-01T00:00:00.000Z" }),
    ];
    const plan = planLeadMergeCluster(
      { ...cluster, leadIds: ["walk", "named"] },
      byId(leads),
    );
    expect(plan.skipped).toBe(false);
    if (!plan.skipped) {
      expect(plan.winnerLeadId).toBe("named");
    }
  });
});
