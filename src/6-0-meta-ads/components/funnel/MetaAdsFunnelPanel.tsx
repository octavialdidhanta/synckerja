import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format, startOfDay, subDays, subMonths, type Locale } from "date-fns";
import { Eye, Loader2, MousePointerClick, ShoppingCart, Wallet, type LucideIcon } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { FunnelCopyButton } from "@/6-0-meta-ads/components/funnel/FunnelCopyButton";
import {
  parseYmdLocal,
  toYmdLocal,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { formatMetaAdsPickerButtonLabel } from "@/meta-ads/lib/formatMetaAdsPickerButtonLabel";
import { MetaAdsFunnelActionFlow } from "@/6-0-meta-ads/components/funnel/MetaAdsFunnelActionFlow";
import { MetaAdsFunnelResultCompare } from "@/6-0-meta-ads/components/funnel/MetaAdsFunnelResultCompare";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  useMetaAdsMetricsQuery,
  type MetaAdsAccountSummary,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import { metaAdsCampaignOptions } from "@/meta-ads/metrics/metaAdsParentFilters";
import {
  META_ADS_FUNNEL_DEFAULT_KEYS,
  META_ADS_FUNNEL_PRESET_CPAS_ID,
  META_ADS_FUNNEL_PRESETS,
  META_ADS_FUNNEL_SLOT_COUNT,
  buildMetaAdsFunnelSummary,
  metaAdsFunnelMetricOptions,
  readMetaAdsFunnelMetric,
  readMetaAdsPurchaseRoas,
  resolveMetaAdsFunnelLevel,
} from "@/meta-ads/metrics/metaAdsFunnel";

const STAGE_COLORS = ["#1D6FEA", "#3B82F6", "#5B9BFF", "#FF6A3D"] as const;
const STEP_CALLOUT_TOP = ["14%", "40%", "60%"] as const;
const STEP_CALLOUT_HEIGHT = ["22%", "16%", "22%"] as const;
const COST_PER_PURCHASE_FRACTION = 0.91;
const COST_COLOR = "#1D6FEA";
const PURCHASE_COLOR = "#FF6A3D";
const FUNNEL_EDGE_GAP = 8;
const FUNNEL_SHORT_LABELS: Record<string, string> = {
  impressions: "Impressions",
  clicks: "Clicks",
  adds_to_cart: "ATC",
  purchases: "Purchases",
  content_views: "Views",
  reach: "Reach",
  spend: "Spend",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  frequency: "Freq",
  aov: "AOV",
  cost_per_atc: "Cost/ATC",
  cost_per_purchase: "CPP",
  purchase_roas: "ROAS",
  purchase_conversion_value: "Value",
  atc_conversion_value: "ATC value",
};

function funnelShortLabel(key: string, fullLabel: string) {
  return FUNNEL_SHORT_LABELS[key] ?? fullLabel;
}

type FunnelCompareMode = "same-dates" | "previous-days";

function funnelCompareWindows(dateStart: string, dateEnd: string) {
  const from = parseYmdLocal(dateStart);
  const to = parseYmdLocal(dateEnd);
  if (!from || !to) return null;
  const days = differenceInCalendarDays(to, from) + 1;
  const previousTo = subDays(startOfDay(from), 1);
  const previousFrom = subDays(previousTo, Math.max(0, days - 1));
  let sameFrom = subMonths(startOfDay(from), 1);
  let sameTo = subMonths(startOfDay(to), 1);
  if (sameTo < sameFrom) {
    const swap = sameFrom;
    sameFrom = sameTo;
    sameTo = swap;
  }
  return {
    previousDays: { fromDate: toYmdLocal(previousFrom), toDate: toYmdLocal(previousTo) },
    sameDates: { fromDate: toYmdLocal(sameFrom), toDate: toYmdLocal(sameTo) },
  };
}

function formatFunnelCompareRange(fromYmd: string, toYmd: string, locale: Locale): string {
  const from = parseYmdLocal(fromYmd);
  const to = parseYmdLocal(toYmd);
  if (!from || !to) return "";
  if (
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate()
  ) {
    return format(from, "d MMM yyyy", { locale });
  }
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${format(from, "d", { locale })}–${format(to, "d MMM yyyy", { locale })}`;
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${format(from, "d MMM", { locale })}–${format(to, "d MMM yyyy", { locale })}`;
  }
  return `${format(from, "d MMM yyyy", { locale })}–${format(to, "d MMM yyyy", { locale })}`;
}

function funnelEdgeX(width: number, verticalFraction: number) {
  const inset = (STAGE_INSET[STAGE_INSET.length - 1] / 100) * verticalFraction;
  return width * (1 - inset);
}
const STAGE_INSET = [0, 8, 16, 24, 32];

const STAGE_ICONS: Record<string, LucideIcon> = {
  impressions: Eye,
  clicks: MousePointerClick,
  adds_to_cart: ShoppingCart,
  purchases: Wallet,
};

function stageClip(index: number): string {
  const top = STAGE_INSET[index] ?? 0;
  const bottom = STAGE_INSET[index + 1] ?? top;
  return `polygon(${top}% 0, ${100 - top}% 0, ${100 - bottom}% 100%, ${bottom}% 100%)`;
}

function selectedIdsForCampaign(
  rows: ReadonlyArray<Record<string, unknown>>,
  selectedIds: readonly string[],
  idField: string,
  campaignId: string,
): string[] {
  if (selectedIds.length === 0) return [];
  const selected = new Set(selectedIds);
  const matched: string[] = [];
  for (const row of rows) {
    const id = String(row[idField] ?? "").trim();
    if (!selected.has(id)) continue;
    if (String(row.campaign_id ?? "").trim() !== campaignId) continue;
    matched.push(id);
  }
  return matched;
}

function formatRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return (
    new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rate) + "%"
  );
}

type Props = {
  organizationId: string | null | undefined;
  adAccountId: string;
  dateStart: string;
  dateEnd: string;
  dateSelection: GoogleAdsDateRangeSelection;
  reportTitle: string;
  enabled: boolean;
  campaignIds: readonly string[];
  adsetIds: readonly string[];
  adIds: readonly string[];
};

export function MetaAdsFunnelPanel({
  organizationId,
  adAccountId,
  dateStart,
  dateEnd,
  dateSelection,
  reportTitle,
  enabled,
  campaignIds,
  adsetIds,
  adIds,
}: Props) {
  const cpasPreset = META_ADS_FUNNEL_PRESETS[0];
  const [metricKeys, setMetricKeys] = useState<string[]>(() => [...cpasPreset.funnelKeys]);
  const [flowKeys, setFlowKeys] = useState<string[]>(() => [...cpasPreset.flowKeys]);
  const [compareMode, setCompareMode] = useState<FunnelCompareMode>("same-dates");
  const reportRef = useRef<HTMLDivElement>(null);
  const { t, dateFnsLocale } = useAppTranslation();
  const level = resolveMetaAdsFunnelLevel({ campaignIds, adsetIds, adIds });
  const compareWindows = useMemo(
    () => funnelCompareWindows(dateStart, dateEnd),
    [dateStart, dateEnd],
  );
  const previousRange = compareWindows
    ? compareMode === "same-dates"
      ? compareWindows.sameDates
      : compareWindows.previousDays
    : null;
  const filterLabel = useMemo(
    () => formatMetaAdsPickerButtonLabel(dateSelection),
    [dateSelection],
  );
  const periodLabel = formatFunnelCompareRange(dateStart, dateEnd, dateFnsLocale);
  const sameDatesLabel = compareWindows
    ? formatFunnelCompareRange(compareWindows.sameDates.fromDate, compareWindows.sameDates.toDate, dateFnsLocale)
    : "";
  const previousDaysLabel = compareWindows
    ? formatFunnelCompareRange(
        compareWindows.previousDays.fromDate,
        compareWindows.previousDays.toDate,
        dateFnsLocale,
      )
    : "";
  const compareLabel = (compareMode === "same-dates" ? sameDatesLabel : previousDaysLabel) || null;
  const metricsQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity: level,
    dateStart,
    dateEnd,
    enabled,
  });
  const previousQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity: level,
    dateStart: previousRange?.fromDate ?? dateStart,
    dateEnd: previousRange?.toDate ?? dateEnd,
    enabled: enabled && previousRange != null,
  });
  const campaignQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity: "campaign",
    dateStart,
    dateEnd,
    enabled,
  });
  const options = useMemo(() => metaAdsFunnelMetricOptions(), []);
  const campaignOptions = useMemo(
    () => metaAdsCampaignOptions(campaignQuery.data?.rows ?? []),
    [campaignQuery.data?.rows],
  );
  const summary = useMemo(
    () =>
      buildMetaAdsFunnelSummary({
        rows: metricsQuery.data?.rows ?? [],
        accountSummary: metricsQuery.data?.summary,
        campaignIds,
        adsetIds,
        adIds,
      }),
    [metricsQuery.data, campaignIds, adsetIds, adIds],
  );
  const previousSummary = useMemo(
    () =>
      buildMetaAdsFunnelSummary({
        rows: previousQuery.data?.rows ?? [],
        accountSummary: previousQuery.data?.summary,
        campaignIds,
        adsetIds,
        adIds,
      }),
    [previousQuery.data, campaignIds, adsetIds, adIds],
  );
  const currency = summary?.currency ?? metricsQuery.data?.summary?.currency ?? null;
  const loading = metricsQuery.isLoading || (metricsQuery.isFetching && !metricsQuery.data);
  const comparing = campaignIds.length >= 2;
  const rows = metricsQuery.data?.rows ?? [];
  const columns = comparing
    ? campaignIds.map((id) => ({
        id,
        name: campaignOptions.find((item) => item.id === id)?.name ?? id,
        summary: buildMetaAdsFunnelSummary({
          rows,
          accountSummary: metricsQuery.data?.summary,
          campaignIds: [id],
          adsetIds: selectedIdsForCampaign(rows, adsetIds, "adset_id", id),
          adIds: selectedIdsForCampaign(rows, adIds, "ad_id", id),
        }),
      }))
    : [{ id: "primary", name: "", summary }];

  const activePresetId = META_ADS_FUNNEL_PRESETS.find(
    (preset) =>
      preset.funnelKeys.length === metricKeys.length &&
      preset.funnelKeys.every((key, index) => key === metricKeys[index]) &&
      preset.flowKeys.length === flowKeys.length &&
      preset.flowKeys.every((key, index) => key === flowKeys[index]),
  )?.id;

  const applyPreset = (id: string) => {
    const preset = META_ADS_FUNNEL_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setMetricKeys([...preset.funnelKeys]);
    setFlowKeys([...preset.flowKeys]);
  };

  const setSlot = (index: number, key: string) => {
    setMetricKeys((current) => {
      const next = current.slice(0, META_ADS_FUNNEL_SLOT_COUNT);
      while (next.length < META_ADS_FUNNEL_SLOT_COUNT) next.push(META_ADS_FUNNEL_DEFAULT_KEYS[next.length]);
      const other = next.indexOf(key);
      if (other >= 0 && other !== index) next[other] = next[index];
      next[index] = key;
      return next;
    });
  };

  if (metricsQuery.isError) {
    return (
      <p className="px-4 py-6 text-sm text-destructive">
        {(metricsQuery.error as Error).message}
      </p>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 w-full min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden bg-white [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="relative flex h-full w-max shrink-0 flex-col bg-white">
      <FunnelCopyButton targetRef={reportRef} disabled={loading} className="absolute right-3 top-1.5 z-20" />
      <div ref={reportRef} className="flex h-full min-h-0 w-max flex-1 flex-col bg-white">
      <p className="shrink-0 px-6 pr-12 pt-2 text-sm font-semibold leading-5 text-[#1c1e21]">
        {reportTitle}
      </p>
      <div className="flex h-full min-h-0 w-max flex-1 items-stretch">
      {columns.map((column) => (
        <div key={column.id} className="flex h-full w-[64rem] shrink-0 flex-col">
          {comparing ? (
            <p className="h-9 shrink-0 truncate px-6 pt-3 text-sm font-medium text-[#1c1e21]" title={column.name}>
              {column.name}
            </p>
          ) : null}
          <FunnelChart
            summary={column.summary}
            currency={column.summary?.currency ?? currency}
            loading={loading}
            metricKeys={metricKeys}
            options={options}
            onSlotChange={setSlot}
            funnelClassName={comparing ? "max-w-[18rem]" : "max-w-[26rem]"}
            className="min-h-0 flex-1"
          />
        </div>
      ))}
      </div>
      </div>
      </div>
      <div className="w-px shrink-0 self-stretch bg-[#d8dbe0]" aria-hidden />
      <MetaAdsFunnelActionFlow
        summary={summary}
        previousSummary={previousQuery.data ? previousSummary : null}
        loading={loading}
        compareLabel={compareLabel}
        dateStart={dateStart}
        dateEnd={dateEnd}
        metricKeys={flowKeys}
        onMetricKeysChange={setFlowKeys}
      />
      <div className="w-px shrink-0 self-stretch bg-[#d8dbe0]" aria-hidden />
      <MetaAdsFunnelResultCompare
        summary={summary}
        previousSummary={previousQuery.data ? previousSummary : null}
        loading={loading}
        compareLabel={compareLabel}
        compareMode={compareMode}
        onCompareModeChange={setCompareMode}
        filterLabel={filterLabel}
        periodLabel={periodLabel}
        sameDatesLabel={sameDatesLabel}
        previousDaysLabel={previousDaysLabel}
        presetValue={activePresetId ?? "custom"}
        onPresetChange={applyPreset}
        presetCustom={activePresetId == null}
        flowKeys={flowKeys}
      />
      </div>
    </div>
  );
}

function FunnelChart({
  summary,
  currency,
  loading,
  metricKeys,
  options,
  onSlotChange,
  funnelClassName,
  className,
}: {
  summary: MetaAdsAccountSummary | null;
  currency: string | null;
  loading: boolean;
  metricKeys: string[];
  options: ReturnType<typeof metaAdsFunnelMetricOptions>;
  onSlotChange: (index: number, key: string) => void;
  funnelClassName: string;
  className?: string;
}) {
  const { t } = useAppTranslation();
  const stages = metricKeys.slice(0, META_ADS_FUNNEL_SLOT_COUNT).map((key, index) => {
    const option = options.find((item) => item.key === key);
    return {
      key,
      index,
      label: option ? t(option.labelKey, option.defaultLabel) : key,
      value: readMetaAdsFunnelMetric(summary, key),
      isCount: option?.valueKind === "count",
    };
  });
  const stepRates = stages.slice(1).map((stage, index) => {
    const previous = stages[index];
    const rate =
      previous?.isCount &&
      stage.isCount &&
      previous.value != null &&
      previous.value > 0 &&
      stage.value != null
        ? (stage.value / previous.value) * 100
        : null;
    return {
      rate,
      currentKey: previous?.key ?? "",
      nextKey: stage.key,
      current: funnelShortLabel(previous?.key ?? "", previous?.label ?? ""),
      next: funnelShortLabel(stage.key, stage.label),
    };
  });
  const purchaseRoas = readMetaAdsPurchaseRoas(summary);
  const cost = readMetaAdsFunnelMetric(summary, "spend");
  const purchaseValue = readMetaAdsFunnelMetric(summary, "purchase_conversion_value");
  const purchases = readMetaAdsFunnelMetric(summary, "purchases");
  const storedCostPerPurchase = readMetaAdsFunnelMetric(summary, "cost_per_purchase");
  const costPerPurchase =
    storedCostPerPurchase ??
    (cost != null && purchases != null && purchases > 0 ? cost / purchases : null);
  const storedAov = readMetaAdsFunnelMetric(summary, "aov");
  const aov =
    storedAov ??
    (purchaseValue != null && purchases != null && purchases > 0 ? purchaseValue / purchases : null);
  const funnelRef = useRef<HTMLDivElement>(null);
  const [funnelWidth, setFunnelWidth] = useState(0);
  const costPerPurchaseTipX = funnelEdgeX(funnelWidth, COST_PER_PURCHASE_FRACTION) + FUNNEL_EDGE_GAP;
  const costPerPurchaseLabelX = costPerPurchaseTipX + 46;
  useLayoutEffect(() => {
    const node = funnelRef.current;
    if (!node) return;
    const measure = () => setFunnelWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative h-full min-h-0 px-6 pb-4 pt-1 ${className ?? ""}`}>
      <div ref={funnelRef} className={`flex h-full w-full min-w-[16rem] flex-col ${funnelClassName}`}>
        {stages.map((stage) => {
          const Icon = STAGE_ICONS[stage.key] ?? Eye;
          const color = STAGE_COLORS[stage.index] ?? STAGE_COLORS[0];
          return (
            <div key={stage.index} className="relative flex min-h-0 flex-1">
              <section
                className="flex min-h-0 flex-1 items-center justify-center text-white"
                style={{ backgroundColor: color, clipPath: stageClip(stage.index) }}
              >
                <div className="flex flex-col items-center px-6 text-center">
                  <Icon className="mb-2 h-5 w-5 opacity-90" aria-hidden />
                  <Select value={stage.key} onValueChange={(next) => onSlotChange(stage.index, next)}>
                    <SelectTrigger className="h-8 w-auto max-w-[12rem] justify-center gap-1 border-0 bg-transparent px-1 text-base font-semibold text-white shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:text-white [&>svg]:opacity-80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {options.map((item) => (
                        <SelectItem key={item.key} value={item.key} className="text-sm">
                          {t(item.labelKey, item.defaultLabel)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm font-medium tabular-nums text-white/90">
                    {loading ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : (
                      formatMetaMetricValue(stage.key, stage.value, currency)
                    )}
                  </p>
                </div>
              </section>
              {stage.index < stages.length - 1 ? (
                <span
                  className="pointer-events-none absolute -bottom-2 left-1/2 z-10 h-3 w-5 -translate-x-1/2"
                  style={{
                    backgroundColor: color,
                    clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {funnelWidth > 0 ? (
        <div className="pointer-events-none absolute inset-x-6 inset-y-4">
          {stepRates.map((step, index) => {
            const top = STEP_CALLOUT_TOP[index] ?? "14%";
            const height = STEP_CALLOUT_HEIGHT[index] ?? "24%";
            const vTop = Number.parseFloat(top) / 100;
            const vBottom = vTop + Number.parseFloat(height) / 100;
            const tipX = funnelEdgeX(funnelWidth, vBottom) + FUNNEL_EDGE_GAP;
            const spineX = funnelEdgeX(funnelWidth, vTop) + FUNNEL_EDGE_GAP + 18;
            return (
              <ElbowCallout
                key={`${step.current}-${step.next}`}
                label={
                  step.currentKey === "impressions" && step.nextKey === "clicks"
                    ? t("digitalMarketing.metaAds.ctr", "CTR")
                    : t("digitalMarketing.metaAds.funnelStageTo", "{{current}} to {{next}}", {
                        current: step.current,
                        next: step.next,
                      })
                }
                value={formatRate(step.rate)}
                color={STAGE_COLORS[index + 1] ?? STAGE_COLORS[0]}
                top={top}
                height={height}
                tipX={tipX}
                spineX={Math.max(spineX, tipX + 28)}
              />
            );
          })}
          <FunnelArrowHead
            color={COST_COLOR}
            left={costPerPurchaseTipX}
            top={`${COST_PER_PURCHASE_FRACTION * 100}%`}
          />
          <FunnelHLine
            color={COST_COLOR}
            left={costPerPurchaseTipX + 10}
            top={`${COST_PER_PURCHASE_FRACTION * 100}%`}
            width={28}
          />
          <BridgeMetric
            left={costPerPurchaseLabelX}
            top={`${COST_PER_PURCHASE_FRACTION * 100}%`}
            label={t("digitalMarketing.metaAds.costPerPurchase", "Cost/Purchase")}
            value={loading ? "—" : formatMetaMetricValue("cost_per_purchase", costPerPurchase, currency)}
            color={COST_COLOR}
          />
          <RoasBridge
            funnelWidth={funnelWidth}
            clearanceX={costPerPurchaseLabelX + 168}
            clearanceFraction={COST_PER_PURCHASE_FRACTION}
            costLabel={t("digitalMarketing.metaAds.funnelCost", "Cost")}
            costValue={loading ? "—" : formatMetaMetricValue("spend", cost, currency)}
            purchaseLabel={t("digitalMarketing.metaAds.funnelPurchaseValue", "Purchase conversion value")}
            purchaseValueText={
              loading ? "—" : formatMetaMetricValue("purchase_conversion_value", purchaseValue, currency)
            }
            purchaseCountText={loading ? "—" : formatMetaMetricValue("purchases", purchases, currency)}
            aovLabel={t("digitalMarketing.metaAds.aov", "AOV")}
            aovValue={loading ? "—" : formatMetaMetricValue("aov", aov, currency)}
            roasLabel={t("digitalMarketing.metaAds.funnelShortRoas", "ROAS")}
            roasValue={loading ? "—" : formatMetaMetricValue("purchase_roas", purchaseRoas, currency)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ElbowCallout({
  label,
  value,
  color,
  top,
  height,
  tipX,
  spineX,
}: {
  label: string;
  value: string;
  color: string;
  top: string;
  height: string;
  tipX: number;
  spineX: number;
}) {
  const arrowWidth = 10;
  return (
    <div className="absolute inset-x-0" style={{ top, height }}>
      <span
        className="absolute top-0 h-0.5"
        style={{ left: spineX - 18, width: 18, backgroundColor: color }}
        aria-hidden
      />
      <span
        className="absolute bottom-[5px] top-0 w-0.5"
        style={{ left: spineX, backgroundColor: color }}
        aria-hidden
      />
      <span
        className="absolute bottom-[5px] h-0.5"
        style={{
          left: tipX + arrowWidth,
          width: Math.max(8, spineX - tipX - arrowWidth),
          backgroundColor: color,
        }}
        aria-hidden
      />
      <svg
        width="10"
        height="12"
        viewBox="0 0 10 12"
        className="absolute bottom-0"
        style={{ left: tipX }}
        aria-hidden
      >
        <path d="M9.5 0.75 L0.75 6 L9.5 11.25 Z" fill={color} />
      </svg>
      <div className="absolute top-1/2 min-w-0 -translate-y-1/2" style={{ left: spineX + 12 }}>
        <p className="whitespace-nowrap text-xs leading-none text-[#65676b]">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums leading-none" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function RoasBridge({
  funnelWidth,
  clearanceX,
  clearanceFraction,
  costLabel,
  costValue,
  purchaseLabel,
  purchaseValueText,
  purchaseCountText,
  aovLabel,
  aovValue,
  roasLabel,
  roasValue,
}: {
  funnelWidth: number;
  clearanceX: number;
  clearanceFraction: number;
  costLabel: string;
  costValue: string;
  purchaseLabel: string;
  purchaseValueText: string;
  purchaseCountText: string;
  aovLabel: string;
  aovValue: string;
  roasLabel: string;
  roasValue: string;
}) {
  const topFraction = 0.08;
  const bottomFraction = 0.96;
  const midFraction = (topFraction + bottomFraction) / 2;
  const arrowWidth = 10;
  const topTipX = funnelEdgeX(funnelWidth, topFraction) + FUNNEL_EDGE_GAP;
  const bottomTipX = funnelEdgeX(funnelWidth, bottomFraction) + FUNNEL_EDGE_GAP;
  const costSpineX = funnelEdgeX(funnelWidth, 0) + FUNNEL_EDGE_GAP + 168;
  const span = bottomFraction - topFraction;
  const clearanceT = span > 0 ? (clearanceFraction - topFraction) / span : 1;
  const slantedSpineX =
    clearanceT > 0.05 ? costSpineX + (clearanceX - costSpineX) / clearanceT : costSpineX - 72;
  const purchaseSpineX = Math.max(bottomTipX + arrowWidth + 36, slantedSpineX);
  const midX =
    costSpineX + ((midFraction - topFraction) / span) * (purchaseSpineX - costSpineX);
  const topY = `${topFraction * 100}%`;
  const midY = `${midFraction * 100}%`;
  const bottomY = `${bottomFraction * 100}%`;

  return (
    <>
      <FunnelArrowHead color={COST_COLOR} left={topTipX} top={topY} />
      <FunnelHLine
        color={COST_COLOR}
        left={topTipX + arrowWidth}
        top={topY}
        width={Math.max(8, costSpineX - topTipX - arrowWidth)}
      />
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <line
          x1={costSpineX + 1}
          y1={topY}
          x2={midX + 1}
          y2={midY}
          stroke={COST_COLOR}
          strokeWidth={2}
        />
        <line
          x1={midX + 1}
          y1={midY}
          x2={purchaseSpineX + 1}
          y2={bottomY}
          stroke={PURCHASE_COLOR}
          strokeWidth={2}
        />
      </svg>
      <FunnelHLine
        color={PURCHASE_COLOR}
        left={bottomTipX + arrowWidth}
        top={bottomY}
        width={Math.max(8, purchaseSpineX - bottomTipX - arrowWidth)}
      />
      <FunnelArrowHead color={PURCHASE_COLOR} left={bottomTipX} top={bottomY} />
      <BridgeMetric left={costSpineX + 16} top={topY} label={costLabel} value={costValue} color={COST_COLOR} />
      <BridgeMetric left={midX + 16} top={midY} label={roasLabel} value={roasValue} color={PURCHASE_COLOR} />
      <PurchaseValueEquation
        left={purchaseSpineX + 16}
        top={`${clearanceFraction * 100}%`}
        label={purchaseLabel}
        value={purchaseValueText}
        purchasesText={purchaseCountText}
        aovLabel={aovLabel}
        aovValue={aovValue}
        color={PURCHASE_COLOR}
      />
    </>
  );
}

function FunnelArrowHead({ color, left, top }: { color: string; left: number; top: string }) {
  return (
    <svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      className="absolute -translate-y-1/2"
      style={{ left, top }}
      aria-hidden
    >
      <path d="M9.5 0.75 L0.75 6 L9.5 11.25 Z" fill={color} />
    </svg>
  );
}

function FunnelHLine({
  color,
  left,
  top,
  width,
}: {
  color: string;
  left: number;
  top: string;
  width: number;
}) {
  return (
    <span
      className="absolute h-0.5 -translate-y-1/2"
      style={{ left, top, width, backgroundColor: color }}
      aria-hidden
    />
  );
}

function BridgeMetric({
  left,
  top,
  label,
  value,
  color,
}: {
  left: number;
  top: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="absolute min-w-0 -translate-y-1/2" style={{ left, top }}>
      <p className="whitespace-nowrap text-xs leading-none text-[#65676b]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function PurchaseValueEquation({
  left,
  top,
  label,
  value,
  purchasesText,
  aovLabel,
  aovValue,
  color,
}: {
  left: number;
  top: string;
  label: string;
  value: string;
  purchasesText: string;
  aovLabel: string;
  aovValue: string;
  color: string;
}) {
  return (
    <div className="absolute min-w-0 -translate-y-1/2" style={{ left, top }}>
      <p className="whitespace-nowrap text-xs leading-none text-[#65676b]">{label}</p>
      <div className="relative mt-1 w-max">
        <p className="whitespace-nowrap text-2xl font-semibold tabular-nums leading-none" style={{ color }}>
          {value}
        </p>
        <div className="absolute left-0 right-0 top-full mt-1.5">
          <div className="flex flex-col items-center">
            <span className="h-px w-full" style={{ backgroundColor: color }} aria-hidden />
            <span className="mt-1 text-center text-sm font-semibold tabular-nums leading-none" style={{ color }}>
              {purchasesText}
            </span>
          </div>
          <div className="absolute left-full top-0 flex -translate-y-1/2 items-center gap-2.5 pl-2.5">
            <span className="text-xl font-semibold leading-none text-[#1c1e21]">=</span>
            <span className="relative">
              <span className="absolute bottom-full left-0 mb-1 whitespace-nowrap text-xs leading-none text-[#65676b]">
                {aovLabel}
              </span>
              <span className="text-2xl font-semibold tabular-nums leading-none" style={{ color }}>
                {aovValue}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
