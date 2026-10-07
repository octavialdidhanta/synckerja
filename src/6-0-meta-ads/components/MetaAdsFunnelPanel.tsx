import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, MousePointerClick, ShoppingCart, Wallet, type LucideIcon } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
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
  META_ADS_FUNNEL_SLOT_COUNT,
  buildMetaAdsFunnelSummary,
  metaAdsFunnelMetricOptions,
  readMetaAdsFunnelMetric,
  readMetaAdsPurchaseRoas,
  resolveMetaAdsFunnelLevel,
} from "@/meta-ads/metrics/metaAdsFunnel";

const STAGE_COLORS = ["#1D6FEA", "#3B82F6", "#5B9BFF", "#FF6A3D"] as const;
const STEP_CALLOUT_TOP = ["14%", "40%", "64%"] as const;
const STEP_CALLOUT_HEIGHT = ["24%", "22%", "20%"] as const;
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
  enabled,
  campaignIds,
  adsetIds,
  adIds,
}: Props) {
  const [metricKeys, setMetricKeys] = useState<string[]>(() => [...META_ADS_FUNNEL_DEFAULT_KEYS]);
  const level = resolveMetaAdsFunnelLevel({ campaignIds, adsetIds, adIds });
  const metricsQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity: level,
    dateStart,
    dateEnd,
    enabled,
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
    <div className="flex h-full min-h-0 w-full flex-1 items-stretch overflow-x-auto">
      {columns.map((column) => (
        <div key={column.id} className="flex h-full min-h-0 min-w-[28rem] flex-1 flex-col">
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
      current: funnelShortLabel(previous?.key ?? "", previous?.label ?? ""),
      next: funnelShortLabel(stage.key, stage.label),
    };
  });
  const purchaseRoas = readMetaAdsPurchaseRoas(summary);
  const funnelRef = useRef<HTMLDivElement>(null);
  const [funnelWidth, setFunnelWidth] = useState(0);
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
    <div className={`relative h-full min-h-0 px-6 py-4 ${className ?? ""}`}>
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
                label={t("digitalMarketing.metaAds.funnelStageTo", "{{current}} to {{next}}", {
                  current: step.current,
                  next: step.next,
                })}
                value={formatRate(step.rate)}
                color={STAGE_COLORS[index + 1] ?? STAGE_COLORS[0]}
                top={top}
                height={height}
                tipX={tipX}
                spineX={Math.max(spineX, tipX + 28)}
              />
            );
          })}
          <PlainLeftCallout
            label={t("digitalMarketing.metaAds.funnelShortRoas", "ROAS")}
            value={loading ? "—" : formatMetaMetricValue("purchase_roas", purchaseRoas, currency)}
            color="#FF6A3D"
            tipX={funnelEdgeX(funnelWidth, 0.93) + FUNNEL_EDGE_GAP}
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

function PlainLeftCallout({
  label,
  value,
  color,
  tipX,
}: {
  label: string;
  value: string;
  color: string;
  tipX: number;
}) {
  return (
    <div className="absolute inset-x-0" style={{ top: "86%", height: "14%" }}>
      <svg
        width="10"
        height="12"
        viewBox="0 0 10 12"
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: tipX }}
        aria-hidden
      >
        <path d="M9.5 0.75 L0.75 6 L9.5 11.25 Z" fill={color} />
      </svg>
      <span
        className="absolute top-1/2 h-0.5 w-5 -translate-y-1/2"
        style={{ left: tipX + 10, backgroundColor: color }}
        aria-hidden
      />
      <div className="absolute top-1/2 min-w-0 -translate-y-1/2" style={{ left: tipX + 36 }}>
        <p className="text-xs leading-snug text-[#65676b]">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-none" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}
