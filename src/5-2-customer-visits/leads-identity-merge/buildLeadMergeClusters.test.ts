import { describe, expect, it } from "vitest";
import { buildLeadMergeClusters } from "./buildLeadMergeClusters";
import type { LeadMergeLeadInput } from "./types";

function lead(
  partial: Partial<LeadMergeLeadInput> & Pick<LeadMergeLeadInput, "id">,
): LeadMergeLeadInput {
  return {
    client: "Walk-in",
    phone_number: null,
    email: null,
    source: "POS",
    ticket_id: `pos-walkin-${partial.id}`,
    updated_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    merged_into_lead_id: null,
    ...partial,
  };
}

describe("buildLeadMergeClusters", () => {
  it("groups duplicate phones (normalized) and ignores singles", () => {
    const leads = [
      lead({ id: "a", phone_number: "081234567890" }),
      lead({ id: "b", phone_number: "6281234567890" }),
      lead({ id: "c", phone_number: "6289999999999" }),
    ];
    const clusters = buildLeadMergeClusters(leads);
    const phone = clusters.filter((c) => c.kind === "phone");
    expect(phone).toHaveLength(1);
    expect(phone[0]?.leadIds.sort()).toEqual(["a", "b"]);
  });

  it("groups duplicate emails case-insensitively", () => {
    const leads = [
      lead({ id: "a", email: "Octa@Mail.com" }),
      lead({ id: "b", email: "octa@mail.com" }),
    ];
    const clusters = buildLeadMergeClusters(leads);
    expect(clusters).toEqual([
      expect.objectContaining({
        kind: "email",
        clusterKey: "octa@mail.com",
        leadIds: expect.arrayContaining(["a", "b"]),
      }),
    ]);
  });

  it("does not cross-link phone-only with email-only", () => {
    const leads = [
      lead({ id: "phone", phone_number: "628111" }),
      lead({ id: "email", email: "same@person.com" }),
    ];
    expect(buildLeadMergeClusters(leads)).toEqual([]);
  });

  it("excludes soft-archived losers and walk-in without identity", () => {
    const leads = [
      lead({ id: "active", phone_number: "6281234567890" }),
      lead({
        id: "archived",
        phone_number: "6281234567890",
        merged_into_lead_id: "active",
      }),
      lead({ id: "anon", client: "Walk-in" }),
    ];
    expect(buildLeadMergeClusters(leads)).toEqual([]);
  });
});
