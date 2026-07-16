import { describe, expect, it } from "vitest";
import {
  defaultMemberCountForKind,
  defaultPaidPlanMemberCount,
  DEFAULT_PAID_PLAN_MAX_MEMBERS,
  filterPlanFeaturesForDisplay,
  getPlanMaxMembers,
  isZeroPricePlan,
  planUsesPerMemberPricing,
  resolveFreePlanMaxMembers,
  isFreeTierPlanForMemberFloor,
  resolvePaidPlanMemberFloor,
  resolvePaidPlanSliderMin,
  resolvePlanSliderMax,
  shouldShowDynamicMemberAllowed,
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

  it("uses structured max_members for paid per-member plans when set", () => {
    expect(getPlanMaxMembers({ ...basePlan, max_members: 50 })).toBe(50);
    expect(getPlanMaxMembers({ ...basePlan, max_members: 1 })).toBe(1);
  });

  it("defaults paid plan without cap to DEFAULT_PAID_PLAN_MAX_MEMBERS", () => {
    expect(getPlanMaxMembers({ ...basePlan, max_members: null })).toBe(DEFAULT_PAID_PLAN_MAX_MEMBERS);
    expect(getPlanMaxMembers({ ...basePlan, max_members: null, features: ["Dashboard selalu aktif"] })).toBe(
      DEFAULT_PAID_PLAN_MAX_MEMBERS,
    );
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

  it("defaults paid plan without cap regardless of features", () => {
    expect(
      getPlanMaxMembers({
        ...basePlan,
        max_members: null,
        features: ["1 Member Allowed", "Rp 50.000 per member / bulan"],
      }),
    ).toBe(DEFAULT_PAID_PLAN_MAX_MEMBERS);
  });

  it("returns enterprise slider max for custom / enterprise plans", () => {
    expect(
      getPlanMaxMembers({
        name: "Enterprise Plan",
        is_custom: true,
        base_price_per_member: 0,
        max_members: null,
        features: [],
        jumlah_hari_trial: null,
      }),
    ).toBe(500);
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
      max_members: 50,
    } as SubscriptionPlanRow;
    expect(sliderMaxMembers(paidPlan, "paid_requires_billing")).toBe(50);

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
    expect(resolvePlanSliderMax(50, 100)).toBe(100);
    expect(resolvePlanSliderMax(50, 20)).toBe(50);
    expect(resolvePlanSliderMax(DEFAULT_PAID_PLAN_MAX_MEMBERS, 20)).toBe(DEFAULT_PAID_PLAN_MAX_MEMBERS);
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

describe("shouldShowDynamicMemberAllowed", () => {
  it("returns true for paid per-member plans", () => {
    expect(shouldShowDynamicMemberAllowed({ base_price_per_member: 99000 })).toBe(true);
    expect(planUsesPerMemberPricing({ base_price_per_member: 1 })).toBe(true);
  });

  it("returns false for free or trial plans", () => {
    expect(shouldShowDynamicMemberAllowed({ base_price_per_member: 0 })).toBe(false);
    expect(shouldShowDynamicMemberAllowed({})).toBe(false);
  });
});

describe("paid plan member floor", () => {
  const freePlan1 = {
    base_price_per_member: 0,
    max_members: 1,
    features: [],
    jumlah_hari_trial: null,
  };
  const freePlan5 = {
    base_price_per_member: 0,
    max_members: 5,
    features: [],
    jumlah_hari_trial: null,
  };
  const paidPlan = {
    base_price_per_member: 99000,
    max_members: null,
    features: [],
    jumlah_hari_trial: null,
  };

  it("isZeroPricePlan detects Rp-0 plans", () => {
    expect(isZeroPricePlan(freePlan1)).toBe(true);
    expect(isZeroPricePlan(paidPlan)).toBe(false);
  });

  it("resolveFreePlanMaxMembers takes MAX across all free plans", () => {
    expect(resolveFreePlanMaxMembers([freePlan1, paidPlan])).toBe(1);
    expect(resolveFreePlanMaxMembers([freePlan1, freePlan5, paidPlan])).toBe(5);
    expect(resolveFreePlanMaxMembers([paidPlan])).toBe(1);
    expect(resolveFreePlanMaxMembers([])).toBe(1);
  });

  it("excludes Enterprise from free-tier floor (avoids paidMemberFloor 501)", () => {
    const enterprise = {
      name: "Enterprise Plan",
      is_custom: true,
      base_price_per_member: 0,
      max_members: null,
      features: [],
      jumlah_hari_trial: null,
    };
    expect(isFreeTierPlanForMemberFloor(enterprise)).toBe(false);
    expect(resolveFreePlanMaxMembers([freePlan1, enterprise, paidPlan])).toBe(1);
    expect(resolvePaidPlanMemberFloor(resolveFreePlanMaxMembers([freePlan1, enterprise]))).toBe(2);
  });

  it("resolvePaidPlanMemberFloor is freeMax + 1", () => {
    expect(resolvePaidPlanMemberFloor(1)).toBe(2);
    expect(resolvePaidPlanMemberFloor(5)).toBe(6);
    expect(resolvePaidPlanMemberFloor(2)).toBe(3);
  });

  it("resolvePaidPlanSliderMin enforces strict floor and mid-cycle seat lock", () => {
    const floor = 2;
    expect(
      resolvePaidPlanSliderMin({ paidMemberFloor: floor }),
    ).toBe(2);
    expect(
      resolvePaidPlanSliderMin({
        paidMemberFloor: floor,
        isCurrentPlan: true,
        isMidCycleActive: true,
        subscribedMemberCount: 1,
      }),
    ).toBe(2);
    expect(
      resolvePaidPlanSliderMin({
        paidMemberFloor: floor,
        isCurrentPlan: true,
        isMidCycleActive: true,
        subscribedMemberCount: 5,
      }),
    ).toBe(5);
  });

  it("defaultPaidPlanMemberCount prefers 5 but respects floor", () => {
    expect(defaultPaidPlanMemberCount(2, 100)).toBe(5);
    expect(defaultPaidPlanMemberCount(6, 100)).toBe(6);
  });
});
