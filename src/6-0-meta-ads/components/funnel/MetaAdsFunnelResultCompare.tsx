import { useRef, type ReactNode } from "react";
import { FormInfoHint } from "@/shared/components/FormInfoHint";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { MetaAdsAccountSummary } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import { FunnelCopyButton } from "@/6-0-meta-ads/components/funnel/FunnelCopyButton";
import {
  META_ADS_FUNNEL_PRESET_CPAS_ID,
  META_ADS_FUNNEL_PRESETS,
  metaAdsFunnelMetricOptions,
  readMetaAdsFunnelMetric,
} from "@/meta-ads/metrics/metaAdsFunnel";

type MetricSpec = {
  key: string;
  labelKey: string;
  fallback: string;
  /** A higher number is a worse result, so an increase is shown in red. */
  invert?: boolean;
  roas?: boolean;
};

const HEADLINE: MetricSpec[] = [
  {
    key: "purchases",
    labelKey: "digitalMarketing.metaAds.purchases",
    fallback: "Purchases",
  },
  {
    key: "purchase_conversion_value",
    labelKey: "digitalMarketing.metaAds.purchaseConversionValue",
    fallback: "Purchase conversion value",
  },
];

const QUARTET: MetricSpec[] = [
  {
    key: "purchase_roas",
    labelKey: "digitalMarketing.metaAds.purchaseRoas",
    fallback: "Purchase ROAS",
    roas: true,
  },
  {
    key: "cost_per_purchase",
    labelKey: "digitalMarketing.metaAds.costPerPurchase",
    fallback: "Cost/Purchase",
    invert: true,
  },
  {
    key: "aov",
    labelKey: "digitalMarketing.metaAds.aov",
    fallback: "AOV",
  },
  {
    key: "atc_conversion_value",
    labelKey: "digitalMarketing.metaAds.atcConversionValue",
    fallback: "ATC conversion value",
  },
];

const MARKETING: MetricSpec[] = [
  {
    key: "spend",
    labelKey: "digitalMarketing.metaAds.spend",
    fallback: "Spend",
    invert: true,
  },
  {
    key: "cpm",
    labelKey: "digitalMarketing.metaAds.cpm",
    fallback: "CPM",
    invert: true,
  },
  {
    key: "ctr",
    labelKey: "digitalMarketing.metaAds.ctr",
    fallback: "CTR",
  },
];

const FLOW_LABELS: Record<string, { key: string; fallback: string }> = {
  content_views: {
    key: "digitalMarketing.metaAds.funnelActionViewContent",
    fallback: "View Content All (Shared item only)",
  },
  adds_to_cart: {
    key: "digitalMarketing.metaAds.funnelActionAddToCart",
    fallback: "Add To Cart All (Shared item only)",
  },
  purchases: {
    key: "digitalMarketing.metaAds.funnelActionPurchase",
    fallback: "Purchase All (Shared item only)",
  },
};

const RATES: MetricSpec[] = [
  {
    key: "click_to_view_rate",
    labelKey: "digitalMarketing.metaAds.clickToViewRate",
    fallback: "% Click to View",
  },
  {
    key: "view_to_atc_rate",
    labelKey: "digitalMarketing.metaAds.viewToAtcRate",
    fallback: "% View to ATC",
  },
  {
    key: "atc_to_purchase_rate",
    labelKey: "digitalMarketing.metaAds.atcToPurchaseRate",
    fallback: "% ATC to Purchase",
  },
];

function changePercent(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function displayValue(spec: MetricSpec, value: number | null, currency: string): string {
  if (value == null) return "—";
  const formatted =
    spec.key === "ctr"
      ? formatMetaMetricValue(spec.key, value, currency, { ctrSource: "api" })
      : formatMetaMetricValue(spec.key, value, currency);
  if (formatted === "—") return formatted;
  return spec.roas ? `${formatted}x` : formatted;
}

function ResultDelta({
  value,
  invert,
  compareLabel,
}: {
  value: number | null;
  invert: boolean;
  compareLabel: string | null;
}) {
  const { t } = useAppTranslation();
  if (value == null || !compareLabel) return null;
  const improved = invert ? value < 0 : value > 0;
  const color = value === 0 ? "text-[#65676b]" : improved ? "text-[#31a24c]" : "text-[#e41e3f]";
  return (
    <p className={`mt-0.5 text-[11px] font-medium leading-4 ${color}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%{" "}
      <span className="font-normal text-[#65676b]">
        {t("digitalMarketing.metaAds.funnelCompareVsRange", "vs {{range}}", { range: compareLabel })}
      </span>
    </p>
  );
}

function MetricFigure({
  spec,
  summary,
  previousSummary,
  currency,
  compareLabel,
}: {
  spec: MetricSpec;
  summary: MetaAdsAccountSummary | null;
  previousSummary: MetaAdsAccountSummary | null;
  currency: string;
  compareLabel: string | null;
}) {
  const { t } = useAppTranslation();
  const current = readMetaAdsFunnelMetric(summary, spec.key);
  const previous = readMetaAdsFunnelMetric(previousSummary, spec.key);
  return (
    <div>
      <p className="text-[11px] font-medium leading-4 text-[#65676b]">{t(spec.labelKey, spec.fallback)}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-[#1c1e21]">
        {displayValue(spec, current, currency)}
      </p>
      <ResultDelta value={changePercent(current, previous)} invert={spec.invert === true} compareLabel={compareLabel} />
    </div>
  );
}

type FunnelCompareMode = "same-dates" | "previous-days";

type Props = {
  summary: MetaAdsAccountSummary | null;
  previousSummary: MetaAdsAccountSummary | null;
  loading: boolean;
  filterLabel: string;
  compareLabel: string | null;
  compareMode: FunnelCompareMode;
  onCompareModeChange: (mode: FunnelCompareMode) => void;
  sameDatesLabel: string;
  previousDaysLabel: string;
  presetValue: string;
  onPresetChange: (id: string) => void;
  presetCustom: boolean;
  flowKeys: string[];
};

export function MetaAdsFunnelResultCompare({
  summary,
  previousSummary,
  loading,
  filterLabel,
  compareLabel,
  compareMode,
  onCompareModeChange,
  sameDatesLabel,
  previousDaysLabel,
  presetValue,
  onPresetChange,
  presetCustom,
  flowKeys = [],
}: Props) {
  const { t } = useAppTranslation();
  const currency = summary?.currency || previousSummary?.currency || "IDR";
  const copyRef = useRef<HTMLDivElement>(null);

  return (
    <section className="relative z-10 flex h-full max-h-full min-h-0 w-[26rem] shrink-0 flex-col overflow-hidden bg-white">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div ref={copyRef}>
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-sm font-semibold text-[#1c1e21]">
            {t("digitalMarketing.metaAds.funnelResultTitle", "Campaign result")}
          </h2>
          <FormInfoHint
            side="left"
            ariaLabel={t("digitalMarketing.metaAds.funnelResultInfo", "How these results are counted")}
            content={
              <div className="space-y-2">
                <p>
                  {t(
                    "digitalMarketing.metaAds.funnelResultCounted",
                    "These numbers are counted by Meta for the selected dates and filters. They are not an estimate.",
                  )}
                </p>
                <p>
                  {t(
                    "digitalMarketing.metaAds.funnelResultShared",
                    "Purchases, cart value, purchase value, and the funnel rates count shared-item actions only.",
                  )}
                </p>
                {compareLabel ? (
                  <p>
                    {t(
                      "digitalMarketing.metaAds.funnelResultDeltaRange",
                      "Each change compares this period with {{range}}.",
                      { range: compareLabel },
                    )}
                  </p>
                ) : null}
              </div>
            }
          />
          <FunnelCopyButton targetRef={copyRef} disabled={loading} className="ml-auto" />
          <Select value={presetValue} onValueChange={onPresetChange}>
            <SelectTrigger className="h-8 w-[8.75rem] shrink-0 gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2 text-xs font-medium text-[#1c1e21] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[12rem]">
              {META_ADS_FUNNEL_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.id === META_ADS_FUNNEL_PRESET_CPAS_ID
                    ? t("digitalMarketing.metaAds.funnelPresetCpas", preset.name)
                    : preset.name}
                </SelectItem>
              ))}
              {presetCustom ? (
                <SelectItem value="custom">
                  {t("digitalMarketing.metaAds.funnelPresetCustom", "Custom")}
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        {filterLabel ? (
          <p className="mt-1 text-xs font-medium leading-4 text-[#1c1e21]">{filterLabel}</p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-[#f0f2f5] p-1">
          <CompareModeButton
            active={compareMode === "same-dates"}
            title={t("digitalMarketing.metaAds.funnelCompareSameDates", "Same dates")}
            range={sameDatesLabel}
            onClick={() => onCompareModeChange("same-dates")}
          />
          <CompareModeButton
            active={compareMode === "previous-days"}
            title={t("digitalMarketing.metaAds.funnelComparePreviousDays", "Previous days")}
            range={previousDaysLabel}
            onClick={() => onCompareModeChange("previous-days")}
          />
        </div>

        {loading ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="h-24 animate-pulse rounded-lg bg-[#eef0f3]" />
              <div className="h-24 animate-pulse rounded-lg bg-[#eef0f3]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-16 animate-pulse rounded-lg bg-[#eef0f3]" />
              <div className="h-16 animate-pulse rounded-lg bg-[#eef0f3]" />
              <div className="h-16 animate-pulse rounded-lg bg-[#eef0f3]" />
              <div className="h-16 animate-pulse rounded-lg bg-[#eef0f3]" />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {HEADLINE.map((spec) => (
                <div key={spec.key} className="rounded-lg border border-dashed border-[#c5cdf8] bg-[#f4f6ff] p-3">
                  <MetricFigure
                    spec={spec}
                    summary={summary}
                    previousSummary={previousSummary}
                    currency={currency}
                    compareLabel={compareLabel}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUARTET.map((spec) => (
                <div key={spec.key} className="rounded-lg border border-[#e5e7eb] p-3">
                  <MetricFigure
                    spec={spec}
                    summary={summary}
                    previousSummary={previousSummary}
                    currency={currency}
                    compareLabel={compareLabel}
                  />
                </div>
              ))}
            </div>
            <ResultGroup
              title={t("digitalMarketing.metaAds.funnelResultMarketing", "Marketing")}
              specs={MARKETING}
              summary={summary}
              previousSummary={previousSummary}
              currency={currency}
              compareLabel={compareLabel}
            />
            <ResultGroup
              title={t("digitalMarketing.metaAds.funnelResultRates", "Funnel rates")}
              specs={RATES}
              summary={summary}
              previousSummary={previousSummary}
              currency={currency}
              compareLabel={compareLabel}
              footer={
                <FlowConversionRate
                  flowKeys={flowKeys}
                  summary={summary}
                  previousSummary={previousSummary}
                  compareLabel={compareLabel}
                />
              }
            />
          </div>
        )}
        <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
        </div>
      </div>
    </section>
  );
}

function CompareModeButton({
  active,
  title,
  range,
  onClick,
}: {
  active: boolean;
  title: string;
  range: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md px-2 py-1.5 text-left ${active ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
    >
      <span className={`block text-xs font-semibold ${active ? "text-[#1c1e21]" : "text-[#65676b]"}`}>{title}</span>
      <span className="block truncate text-[11px] leading-4 text-[#65676b]">{range || "—"}</span>
    </button>
  );
}

function stepShare(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return (current / previous) * 100;
}

function flowStepLabel(key: string, t: (key: string, fallback: string) => string): string {
  const shared = FLOW_LABELS[key];
  if (shared) return t(shared.key, shared.fallback);
  const option = metaAdsFunnelMetricOptions().find((item) => item.key === key);
  return option ? t(option.labelKey, option.defaultLabel) : key;
}

function FlowConversionRate({
  flowKeys,
  summary,
  previousSummary,
  compareLabel,
}: {
  flowKeys: string[];
  summary: MetaAdsAccountSummary | null;
  previousSummary: MetaAdsAccountSummary | null;
  compareLabel: string | null;
}) {
  const { t } = useAppTranslation();
  const firstKey = flowKeys[0];
  const lastKey = flowKeys[flowKeys.length - 1];
  if (!firstKey || !lastKey) return null;
  const firstLabel = flowStepLabel(firstKey, t);
  const lastLabel = flowStepLabel(lastKey, t);
  const conversion = stepShare(
    readMetaAdsFunnelMetric(summary, lastKey),
    readMetaAdsFunnelMetric(summary, firstKey),
  );
  const previousConversion = stepShare(
    readMetaAdsFunnelMetric(previousSummary, lastKey),
    readMetaAdsFunnelMetric(previousSummary, firstKey),
  );
  const delta =
    conversion != null && previousConversion != null && previousConversion > 0
      ? ((conversion - previousConversion) / previousConversion) * 100
      : null;
  const sharedOnly = flowKeys.every((key) => key in FLOW_LABELS);

  return (
    <div className="border-t border-[#eef0f3] pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-[#1c1e21]">
              {t("digitalMarketing.metaAds.funnelConversion", "Conversion rate")}
            </p>
            <FormInfoHint
              side="top"
              ariaLabel={t("digitalMarketing.metaAds.funnelActionConversionInfo", "Conversion rate formula")}
              content={
            <div className="space-y-2">
              <p>
                {t(
                  "digitalMarketing.metaAds.funnelActionConversionHint",
                  "{{last}} divided by {{first}}, then multiplied by 100.",
                  { first: firstLabel, last: lastLabel },
                )}
              </p>
              <p className="font-medium">
                {t(
                  "digitalMarketing.metaAds.funnelActionConversionFormula",
                  "Conversion rate = last step ÷ first step × 100",
                )}
              </p>
              {sharedOnly ? (
                <p>
                  {t(
                    "digitalMarketing.metaAds.funnelActionConversionShared",
                    "Both steps count shared-item actions only.",
                  )}
                </p>
              ) : null}
              {compareLabel ? (
                <p>
                  {t(
                    "digitalMarketing.metaAds.funnelActionConversionDeltaRange",
                    "The change compares this rate with the same steps on {{range}}.",
                    { range: compareLabel },
                  )}
                </p>
              ) : null}
            </div>
          }
        />
          </div>
          {sharedOnly ? (
            <p className="mt-0.5 text-[11px] leading-4 text-[#65676b]">
              ({t("digitalMarketing.metaAds.funnelActionShared", "Shared item only")})
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[#1c1e21]">
            {conversion == null ? "—" : `${conversion.toFixed(2)}%`}
          </p>
          <ResultDelta value={delta} invert={false} compareLabel={compareLabel} />
        </div>
      </div>
    </div>
  );
}

function ResultGroup({
  title,
  specs,
  summary,
  previousSummary,
  currency,
  compareLabel,
  footer,
}: {
  title: string;
  specs: MetricSpec[];
  summary: MetaAdsAccountSummary | null;
  previousSummary: MetaAdsAccountSummary | null;
  currency: string;
  compareLabel: string | null;
  footer?: ReactNode;
}) {
  const { t } = useAppTranslation();
  return (
    <div className="rounded-lg border border-[#e5e7eb] p-3">
      <p className="text-sm font-semibold text-[#1c1e21]">{title}</p>
      <div className="mt-2 space-y-2">
        {specs.map((spec) => {
          const current = readMetaAdsFunnelMetric(summary, spec.key);
          const previous = readMetaAdsFunnelMetric(previousSummary, spec.key);
          return (
            <div key={spec.key} className="flex items-start justify-between gap-3 border-t border-[#eef0f3] pt-2 first:border-t-0 first:pt-0">
              <p className="pt-0.5 text-xs text-[#65676b]">{t(spec.labelKey, spec.fallback)}</p>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#1c1e21]">{displayValue(spec, current, currency)}</p>
                <ResultDelta
                  value={changePercent(current, previous)}
                  invert={spec.invert === true}
                  compareLabel={compareLabel}
                />
              </div>
            </div>
          );
        })}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
