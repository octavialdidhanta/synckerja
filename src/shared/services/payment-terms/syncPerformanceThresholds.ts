import { supabase } from "@/shared/lib/supabaseClient";

export type ThresholdCommon = {
  organization_id: string;
  payment_terms_id: string;
  kol_content_post_id: string | null;
  kol_profile_id: string | null;
  campaign_id: string | null;
  is_active: boolean;
  description: string | null;
};

const normalizeMetricType = (metric: string): string => {
  const m = String(metric || "").toLowerCase();
  return m === "conversions" ? "conversion" : m;
};

export function collectThresholdRows(
  thresholds: unknown,
  common: ThresholdCommon,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  const pushRow = (metric: string, value: unknown, bonus?: unknown) => {
    const metricType = normalizeMetricType(metric);
    if (value === undefined || value === null || Number.isNaN(Number(value))) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    rows.push({
      ...common,
      metric_type: metricType,
      target_value: n,
      bonus_percentage:
        bonus !== undefined && bonus !== null && String(bonus) !== "" ? Number(bonus) : 0,
    });
  };

  if (Array.isArray(thresholds)) {
    thresholds.forEach((t: { metric?: string; threshold?: unknown; bonus_percentage?: unknown }) => {
      pushRow(String(t.metric || "").toLowerCase(), t.threshold, t.bonus_percentage);
    });
    return rows;
  }

  if (!thresholds || typeof thresholds !== "object") return rows;

  const o = thresholds as Record<string, unknown>;
  let nestedFound = false;

  for (const [key, val] of Object.entries(o)) {
    if (val && typeof val === "object" && !Array.isArray(val) && "threshold" in (val as object)) {
      nestedFound = true;
      const item = val as { threshold?: unknown; bonus_percentage?: unknown };
      pushRow(key, item.threshold, item.bonus_percentage);
    }
  }

  if (nestedFound) return rows;

  pushRow("reach", o.target_reach, o.reach_bonus_percentage);
  pushRow("engagement", o.target_engagement, o.engagement_bonus_percentage);
  pushRow(
    "conversion",
    (o as { target_conversions?: unknown }).target_conversions ??
      (o as { target_conversion?: unknown }).target_conversion,
    o.conversion_bonus_percentage,
  );
  pushRow("views", o.target_views, o.views_bonus_percentage);
  pushRow("clicks", o.target_clicks, o.clicks_bonus_percentage);
  pushRow("saves", o.target_saves, o.saves_bonus_percentage);
  pushRow("shares", o.target_shares, o.shares_bonus_percentage);
  pushRow("comments", o.target_comments, o.comments_bonus_percentage);
  pushRow("likes", o.target_likes, o.likes_bonus_percentage);

  return rows;
}

function isMissingSchemaError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = String((err as { message?: string })?.message || "");
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("Could not find the table") ||
    msg.includes("schema cache")
  );
}

let kolPerformanceThresholdsUnavailableSession = false;

export async function syncPerformanceThresholdRows(rows: Record<string, unknown>[]) {
  if (rows.length === 0 || kolPerformanceThresholdsUnavailableSession) return;
  const { error } = await supabase.from("kol_performance_thresholds").insert(rows);
  if (error) {
    if (isMissingSchemaError(error)) {
      kolPerformanceThresholdsUnavailableSession = true;
      return;
    }
    console.error("Failed to sync performance thresholds:", error);
    throw error;
  }
}

export async function replacePerformanceThresholdRows(
  paymentTermsId: string,
  organizationId: string,
  thresholds: unknown,
  common: Omit<ThresholdCommon, "payment_terms_id" | "organization_id">,
) {
  if (kolPerformanceThresholdsUnavailableSession) return;

  const { error: delErr } = await supabase
    .from("kol_performance_thresholds")
    .delete()
    .eq("payment_terms_id", paymentTermsId)
    .eq("organization_id", organizationId);

  if (delErr && !isMissingSchemaError(delErr)) {
    console.error("Failed to clear performance thresholds:", delErr);
    throw delErr;
  }
  if (delErr && isMissingSchemaError(delErr)) {
    kolPerformanceThresholdsUnavailableSession = true;
    return;
  }

  const rows = collectThresholdRows(thresholds, {
    organization_id: organizationId,
    payment_terms_id: paymentTermsId,
    ...common,
  });
  await syncPerformanceThresholdRows(rows);
}
