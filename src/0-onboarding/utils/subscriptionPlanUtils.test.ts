import { describe, expect, it } from "vitest";
import {
  defaultMemberCountForKind,
  filterPlanFeaturesForDisplay,
  getPlanMaxMembers,
  resolvePlanSliderMax,
  sliderMaxMembers,
} from "@/0-onboarding/utils/subscriptionPlanUtils";
import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";

const basePlan = {
  features: [] as string[],
  base_price_per_member: 50000,
  jumlah_hari_trial: null,
} satisfies Partial<SubscriptionPlanRow>;

describe("subscriptionPlanUtils max_members", () => {
  it("prefers structured max_members column for free plans", () => {
    expect(
      getPlanMaxMembers({ ...basePlan, base_price_per_member: 0, max_members: 1 }),
    ).toBe(1);
    expect(
      getPlanMaxMembers({ ...basePlan, base_price_per_member: 0, max_members: 5 }),
    ).toBe(5);
  });

  it("ignores max_members for paid per-member plans", () => {
    expect(getPlanMaxMembers({ ...basePlan, max_members: 1 })).toBe(100);
    expect(getPlanMaxMembers({ ...basePlan, max_members: 100 })).toBe(100);
  });

  it("parses N Member Allowed from features when max_members null on free plan", () => {
    expect(
      getPlanMaxMembers({
        base_price_per_member: 0,
        jumlah_hari_trial: null,
        max_members: null,
        features: ["1 Member Allowed", "Rp 0 per member / bulan"],
      }),
    ).toBe(1);
  });

  it("defaults paid plan to 100 regardless of features", () => {
    expect(
      getPlanMaxMembers({
        ...basePlan,
        max_members: null,
        features: ["1 Member Allowed", "Rp 50.000 per member / bulan"],
      }),
    ).toBe(100);
    expect(getPlanMaxMembers({ ...basePlan, max_members: null, features: ["Dashboard selalu aktif"] })).toBe(
      100,
    );
  });

  it("defaults free trial plan to 1 when no max or feature match", () => {
    expect(
      getPlanMaxMembers({
        base_price_per_member: 0,
        max_members: null,
        jumlah_hari_trial: 14,
        features: [],
      }),
    ).toBe(1);
  });

  it("sliderMaxMembers delegates to getPlanMaxMembers", () => {
    const paidPlan = {
      ...basePlan,
      max_members: 1,
    } as SubscriptionPlanRow;
    expect(sliderMaxMembers(paidPlan, "paid_requires_billing")).toBe(100);

    const freePlan = {
      ...basePlan,
      base_price_per_member: 0,
      max_members: 1,
    } as SubscriptionPlanRow;
    expect(sliderMaxMembers(freePlan, "free_forever")).toBe(1);
  });

  it("defaultMemberCountForKind respects cap of 1", () => {
    expect(defaultMemberCountForKind("paid_requires_billing", 1)).toBe(1);
    expect(defaultMemberCountForKind("scheduled_trial", 1)).toBe(1);
  });

  it("resolvePlanSliderMax grandfathers subscribed seats above plan cap", () => {
    expect(resolvePlanSliderMax(10, 50)).toBe(50);
    expect(resolvePlanSliderMax(100, 20)).toBe(100);
  });
});

describe("filterPlanFeaturesForDisplay", () => {
  it("removes member cap lines for paid per-member plans", () => {
    expect(
      filterPlanFeaturesForDisplay(
        ["1 Member Allowed", "Rp 99.000 per member / bulan", "Dashboard selalu aktif"],
        { base_price_per_member: 99000 },
      ),
    ).toEqual(["Dashboard"]);
  });

  it("hides per-member price line for paid plans", () => {
    expect(
      filterPlanFeaturesForDisplay(
        ["Rp 99.000 per member / bulan", "Rp 99,000 per member / bulan", "Dashboard selalu aktif"],
        { base_price_per_member: 99000 },
      ),
    ).toEqual(["Dashboard"]);
  });

  it("keeps member cap lines for free plans", () => {
    const features = ["1 Member Allowed", "Rp 0 per member / bulan", "Dashboard selalu aktif"];
    expect(filterPlanFeaturesForDisplay(features, { base_price_per_member: 0 })).toEqual([
      "1 Member Allowed",
      "Dashboard",
    ]);
  });

  it("hides per-member price line for free plans", () => {
    expect(
      filterPlanFeaturesForDisplay(
        ["Rp 0 per member / bulan", "Modul OKR", "Dashboard selalu aktif"],
        { base_price_per_member: 0 },
      ),
    ).toEqual(["Modul OKR", "Dashboard"]);
  });

  it("shortens Dashboard selalu aktif to Dashboard", () => {
    expect(
      filterPlanFeaturesForDisplay(["Dashboard selalu aktif"], { base_price_per_member: 99000 }),
    ).toEqual(["Dashboard"]);
  });
});
