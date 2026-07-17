import { describe, expect, it } from "vitest";
import {
  getMissingContactFields,
  resolveFlowBranch,
  isContactGateEnabled,
} from "../../../../supabase/functions/_shared/leadMagnet/contactGate/skipMatrix.ts";

describe("skipMatrix", () => {
  it("contact gate off uses legacy branch", () => {
    expect(
      resolveFlowBranch({
        campaign: { contact_gate_enabled: false },
        profile: { phone_number: null, email: null },
        isFollower: true,
      }).branch,
    ).toBe("legacy_material_or_delivery");
  });

  it("non-follower needs follow gate when contact gate on", () => {
    expect(
      resolveFlowBranch({
        campaign: { contact_gate_enabled: true },
        profile: { phone_number: null, email: null },
        isFollower: false,
      }).branch,
    ).toBe("needs_follow_gate");
  });

  it("complete profile delivers instagram", () => {
    expect(
      resolveFlowBranch({
        campaign: { contact_gate_enabled: true },
        profile: { phone_number: "628123", email: "a@b.com" },
        isFollower: true,
      }).branch,
    ).toBe("deliver_instagram");
  });

  it("progressive missing fields", () => {
    expect(getMissingContactFields({ phone_number: null, email: null })).toBe("any");
    expect(getMissingContactFields({ phone_number: "6281", email: null })).toBe("email");
    expect(getMissingContactFields({ phone_number: null, email: "a@b.com" })).toBe("phone");
    expect(getMissingContactFields({ phone_number: "6281", email: "a@b.com" })).toBe(null);
  });

  it("isContactGateEnabled default false", () => {
    expect(isContactGateEnabled({ contact_gate_enabled: false })).toBe(false);
    expect(isContactGateEnabled({ contact_gate_enabled: true })).toBe(true);
  });
});
