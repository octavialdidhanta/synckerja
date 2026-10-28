import { useTranslation } from "react-i18next";
import {
  formatAudienceSize,
  formatAudienceSizeExact,
  isMetaReachPrivacyFloor,
  type MetaReachEstimate,
} from "@/meta-ads/hooks/useMetaAdsTargeting";

export type InterestResearchDeliverySummary = {
  mau_lower: number | null;
  mau_upper: number | null;
  estimate_ready: boolean | null;
  curve_available: boolean;
};

export type InterestResearchReachResult = {
  estimate: MetaReachEstimate;
  delivery_summary: InterestResearchDeliverySummary;
  country_code: string;
  daily?: { lower: number | null; upper: number | null } | null;
  daily_source?: string | null;
  objective_downgraded?: boolean;
};

type InterestResearchReachPanelProps = {
  result: InterestResearchReachResult;
};

export function InterestResearchReachPanel({ result }: InterestResearchReachPanelProps) {
  const { t } = useTranslation();
  const { estimate, country_code, daily, objective_downgraded } = result;
  const hasDaily = daily && (daily.lower != null || daily.upper != null);
  const potentialFloor = isMetaReachPrivacyFloor(estimate.users_lower, estimate.users_upper);

  return (
    <div className="rounded-md border border-sky-200/80 bg-sky-50/50 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="font-semibold text-gray-900">
          {t("digitalMarketing.metaAds.interestReachTitle", "Potential reach")}
        </h4>
        <span className="text-[11px] text-muted-foreground">{country_code}</span>
        {estimate.estimate_ready ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
            {t("digitalMarketing.metaAds.interestReachReady", "Ready")}
          </span>
        ) : (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
            {t("digitalMarketing.metaAds.interestReachPending", "Not ready")}
          </span>
        )}
        {objective_downgraded ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
            REACH
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("digitalMarketing.metaAds.interestColPotential", "Potential Reach")}
          </p>
          <p className={`tabular-nums text-base font-semibold ${potentialFloor ? "text-amber-700" : "text-gray-900"}`}>
            {formatAudienceSize(estimate.users_lower, estimate.users_upper)}
          </p>
          {potentialFloor ? (
            <p className="mt-0.5 text-[10px] leading-tight text-amber-800">
              {t(
                "digitalMarketing.metaAds.interestPotentialFloorShort",
                "Batas privasi Meta (≤1.000), bukan estimasi presisi",
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {formatAudienceSizeExact(estimate.users_lower, estimate.users_upper)}
            </p>
          )}
        </div>
        <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("digitalMarketing.metaAds.interestColDaily", "Daily Reach")}
          </p>
          <p className="tabular-nums text-base font-semibold text-gray-900">
            {hasDaily ? formatAudienceSize(daily.lower, daily.upper) : "—"}
          </p>
          {!hasDaily ? (
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {t(
                "digitalMarketing.metaAds.interestDailyUnavailable",
                "Meta tidak menyediakan estimasi harian",
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
