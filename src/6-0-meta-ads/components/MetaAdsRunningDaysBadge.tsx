import { FormInfoHint } from "@/shared/components/FormInfoHint";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  metaAdCtrPercent,
  metaAdRunningDaysTone,
  type MetaAdRunningDaysTone,
} from "@/meta-ads/metrics/metaAdRunningDays";

const TONE_CLASS: Record<MetaAdRunningDaysTone, string> = {
  "week-green": "bg-green-100 text-green-800",
  "week-lime": "bg-lime-200 text-lime-950",
  "week-yellow": "bg-yellow-200 text-yellow-950",
  "week-amber": "bg-amber-300 text-amber-950",
  "ctr-green": "bg-green-100 text-green-800",
  "ctr-yellow": "bg-yellow-300 text-yellow-950",
  "ctr-red": "bg-red-600 text-white",
};

export function MetaAdsRunningDaysInfo() {
  const { t } = useAppTranslation();
  return (
    <FormInfoHint
      side="bottom"
      ariaLabel={t("digitalMarketing.metaAds.runningDaysInfo", "Days formula")}
      content={
        <div className="space-y-2">
          <p>
            {t(
              "digitalMarketing.metaAds.runningDaysHint",
              "Calendar days since this ad was created, including today.",
            )}
          </p>
          <p className="font-medium">
            {t(
              "digitalMarketing.metaAds.runningDaysFormula",
              "Days = today − created date + 1",
            )}
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              {t(
                "digitalMarketing.metaAds.runningDaysRuleWeek1",
                "1–7 days: green. CTR is ignored.",
              )}
            </li>
            <li>
              {t(
                "digitalMarketing.metaAds.runningDaysRuleWeek2",
                "8–14 days: yellow-green. CTR is ignored.",
              )}
            </li>
            <li>
              {t(
                "digitalMarketing.metaAds.runningDaysRuleCtrHigh",
                "After 14 days, CTR above 2%: green.",
              )}
            </li>
            <li>
              {t(
                "digitalMarketing.metaAds.runningDaysRuleCtrMid",
                "CTR from 1% through 2%: yellow.",
              )}
            </li>
            <li>
              {t(
                "digitalMarketing.metaAds.runningDaysRuleCtrLow",
                "CTR below 1%: red with white text.",
              )}
            </li>
            <li>
              {t(
                "digitalMarketing.metaAds.runningDaysRuleNoCtr",
                "After 14 days with no CTR yet: yellow through day 21, then amber.",
              )}
            </li>
          </ul>
        </div>
      }
    />
  );
}

export function MetaAdsRunningDaysBadge({ days, ctr }: { days: number; ctr: unknown }) {
  const tone = metaAdRunningDaysTone(days, metaAdCtrPercent(ctr));
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.75rem] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        TONE_CLASS[tone],
      )}
    >
      {days}
    </span>
  );
}
