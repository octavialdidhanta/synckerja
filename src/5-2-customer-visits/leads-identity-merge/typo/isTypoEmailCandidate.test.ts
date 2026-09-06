import { describe, expect, it } from "vitest";
import {
  isTypoDomainOf,
  isTypoEmailCandidate,
  isValidIdentityEmail,
} from "./isTypoEmailCandidate";
import { buildTypoEmailClusters } from "./buildTypoEmailClusters";
import { planTypoEmailCluster } from "./planTypoEmailCluster";
import type { LeadMergeLeadInput } from "../types";

function lead(
  partial: Partial<LeadMergeLeadInput> & Pick<LeadMergeLeadInput, "id">,
): LeadMergeLeadInput {
  return {
    client: "Octa",
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

describe("isTypoEmailCandidate", () => {
  it("flags glued TLD as typo", () => {
    expect(isValidIdentityEmail("papadhanta@gmail.com")).toBe(true);
    expect(isTypoEmailCandidate("papadhanta@gmail.comsss")).toBe(true);
    expect(isTypoDomainOf("gmail.com", "gmail.comsss")).toBe(true);
  });
});

describe("buildTypoEmailClusters + plan", () => {
  it("maps comsss typo to single valid target", () => {
    const leads = [
      lead({ id: "valid", email: "papadhanta@gmail.com" }),
      lead({ id: "typo", email: "papadhanta@gmail.comsss" }),
    ];
    const clusters = buildTypoEmailClusters(leads);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.validLeadIds).toEqual(["valid"]);
    const plan = planTypoEmailCluster(clusters[0]!);
    expect(plan.skipped).toBe(false);
    if (!plan.skipped) {
      expect(plan.winnerLeadId).toBe("valid");
      expect(plan.loserLeadIds).toEqual(["typo"]);
    }
  });

  it("skips when no valid target", () => {
    const clusters = buildTypoEmailClusters([
      lead({ id: "typo", email: "alone@gmail.comsss" }),
    ]);
    expect(planTypoEmailCluster(clusters[0]!).skipReason).toBe("no_typo_target");
  });

  it("skips when multiple valid targets", () => {
    const clusters = buildTypoEmailClusters([
      lead({ id: "v1", email: "a@gmail.com" }),
      lead({ id: "v2", email: "a@gmail.com" }),
      lead({ id: "typo", email: "a@gmail.comsss" }),
    ]);
    // Two valids with same email shouldn't normally exist after fase3 unique —
    // build still lists both if present in input.
    expect(planTypoEmailCluster(clusters[0]!).skipReason).toBe("ambiguous_typo_target");
  });
});
