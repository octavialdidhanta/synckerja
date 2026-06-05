/** Campaign-level targets: reach & conversion are counts; engagement is rate 0–100%. */

export function normalizeLegacyEngagementTarget(
  value: number | null | undefined,
  targetReach?: number | null,
): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (n <= 0) return null;
  if (n <= 100) return n;
  if (targetReach && targetReach > 0) {
    const asPercent = Math.round((n / targetReach) * 1000) / 10;
    return Math.min(100, Math.max(0.1, asPercent));
  }
  return null;
}

export function formatCampaignEngagementTarget(
  value: number | null | undefined,
  targetReach?: number | null,
): string {
  const normalized = normalizeLegacyEngagementTarget(value, targetReach);
  if (normalized == null) return "Not set";
  return `${normalized}%`;
}

export function getRoiColorClass(roiPercent: number): string {
  if (Number.isNaN(roiPercent)) return "text-gray-600";
  if (roiPercent > 0) return "text-green-600";
  if (roiPercent < 0) return "text-red-600";
  return "text-gray-600";
}

export function parseRoiPercent(campaign: {
  total_budget?: number | null;
  allocated_budget?: number | null;
}): number | null {
  const total = Number(campaign.total_budget ?? 0);
  const allocated = Number(campaign.allocated_budget ?? 0);
  if (!total || !allocated) return null;
  return ((allocated - total) / total) * 100;
}

export type CampaignTargetInput = {
  target_reach?: number | null;
  target_engagement?: number | null;
  target_conversion?: number | null;
};

export function validateCampaignTargets(
  input: CampaignTargetInput,
): { ok: true } | { ok: false; message: string } {
  const reach = Number(input.target_reach);
  const engagement = Number(input.target_engagement);
  const conversion = Number(input.target_conversion);

  if (!Number.isFinite(reach) || reach <= 0) {
    return { ok: false, message: "Target reach wajib diisi (angka > 0)." };
  }
  if (!Number.isFinite(engagement) || engagement <= 0 || engagement > 100) {
    return {
      ok: false,
      message: "Target engagement wajib diisi sebagai persen (0.1–100).",
    };
  }
  if (!Number.isFinite(conversion) || conversion <= 0) {
    return { ok: false, message: "Target conversion wajib diisi (angka > 0)." };
  }
  return { ok: true };
}

/** Agreement/post threshold label by metric type. */
export function getThresholdFieldLabel(metric: string): string {
  switch (String(metric || "").toLowerCase()) {
    case "reach":
      return "Target Reach (jumlah)";
    case "engagement":
      return "Target Engagement (jumlah interaksi)";
    case "conversion":
    case "conversions":
      return "Target Conversion (jumlah)";
    case "views":
      return "Target Views (jumlah)";
    default:
      return "Threshold";
  }
}

export function getThresholdFieldHint(metric: string): string {
  switch (String(metric || "").toLowerCase()) {
    case "reach":
      return "Total reach yang harus dicapai (contoh: 120.000).";
    case "engagement":
      return "Total interaksi (likes+comments+shares atau impressions×rate). Bukan persen.";
    case "conversion":
    case "conversions":
      return "Jumlah konversi yang harus tercapai.";
    default:
      return "";
  }
}
