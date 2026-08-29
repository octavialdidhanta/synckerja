import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";

export type PosOutletReward = {
  id: string;
  kind: "discount" | "promo";
  title: string;
  subtitle: string;
  pointsLabel: string;
  amountUnit: "rp" | "percent" | null;
  amountValue: number | null;
};

export function usePosOutletRewards(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(organizationId && outletId);

  return useQuery({
    queryKey: ["pos-outlet-rewards", organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosOutletReward[]> => {
      if (!organizationId || !outletId) return [];

      const [{ data: discounts, error: dErr }, { data: promos, error: pErr }] =
        await Promise.all([
          supabase
            .from("catalog_discounts")
            .select(
              "id, name, amount_unit, amount_value, is_active, catalog_discount_outlets(outlet_id)",
            )
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("catalog_promos")
            .select(
              "id, name, is_active, reward_amount_unit, reward_amount_value, catalog_promo_outlets(outlet_id)",
            )
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .limit(50),
        ]);
      if (dErr) throw dErr;
      if (pErr) throw pErr;

      const rewards: PosOutletReward[] = [];

      for (const row of discounts ?? []) {
        const outlets = (row as { catalog_discount_outlets?: Array<{ outlet_id: string }> })
          .catalog_discount_outlets;
        const ids = (outlets ?? []).map((o) => o.outlet_id);
        if (ids.length > 0 && !ids.includes(outletId)) continue;
        const unit = (row as { amount_unit?: string | null }).amount_unit;
        const value = Number((row as { amount_value?: number | null }).amount_value ?? 0);
        const subtitle =
          unit === "percent"
            ? `*${value}%`
            : unit === "rp"
              ? `*${formatStoreCheckoutRp(value)}`
              : "";
        rewards.push({
          id: String(row.id),
          kind: "discount",
          title: String(row.name ?? "Discount"),
          subtitle,
          pointsLabel: "—",
          amountUnit: unit === "percent" || unit === "rp" ? unit : null,
          amountValue: Number.isFinite(value) ? value : null,
        });
      }

      for (const row of promos ?? []) {
        const outlets = (row as { catalog_promo_outlets?: Array<{ outlet_id: string }> })
          .catalog_promo_outlets;
        const ids = (outlets ?? []).map((o) => o.outlet_id);
        if (ids.length > 0 && !ids.includes(outletId)) continue;
        const unit = (row as { reward_amount_unit?: string | null }).reward_amount_unit;
        const value = Number((row as { reward_amount_value?: number | null }).reward_amount_value ?? 0);
        const subtitle =
          unit === "percent"
            ? `*${value}%`
            : unit === "rp"
              ? `*${formatStoreCheckoutRp(value)}`
              : "*Promo";
        rewards.push({
          id: String(row.id),
          kind: "promo",
          title: String(row.name ?? "Promo"),
          subtitle,
          pointsLabel: "—",
          amountUnit: unit === "percent" || unit === "rp" ? unit : null,
          amountValue: Number.isFinite(value) ? value : null,
        });
      }

      return rewards;
    },
  });
}

/** Apply simple fixed/percent reward to a grand total (v1). */
export function applyPosRewardToTotal(
  grandTotal: number,
  reward: PosOutletReward | null | undefined,
): number {
  if (!reward || reward.amountValue == null || reward.amountValue <= 0) {
    return Math.max(0, Math.round(grandTotal));
  }
  if (reward.amountUnit === "percent") {
    const cut = Math.round((grandTotal * reward.amountValue) / 100);
    return Math.max(0, Math.round(grandTotal - cut));
  }
  if (reward.amountUnit === "rp") {
    return Math.max(0, Math.round(grandTotal - reward.amountValue));
  }
  return Math.max(0, Math.round(grandTotal));
}
