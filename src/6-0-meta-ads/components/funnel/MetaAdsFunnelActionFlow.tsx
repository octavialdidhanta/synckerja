import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { parseYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { MetaAdsAccountSummary } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  metaAdsFunnelMetricOptions,
  readMetaAdsFunnelMetric,
} from "@/meta-ads/metrics/metaAdsFunnel";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import { FunnelCopyButton } from "@/6-0-meta-ads/components/funnel/FunnelCopyButton";

const SHARED_ITEM_LABELS: Record<string, { key: string; fallback: string }> = {
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
const MAX_SLOTS = 4;
const BAR_COLOR = "#8E9BFF";
const CONNECTOR_COLOR = "#E4E9FF";
const BAR_WIDTH = 68;
const PLOT_HEIGHT = 84;

function connectorPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  return `M ${x1} ${y1} C ${x1 + dx * 0.42} ${y1}, ${x2 - dx * 0.42} ${y2}, ${x2} ${y2} L ${x2} 100 L ${x1} 100 Z`;
}

function barEdges(index: number, count: number) {
  const column = 100 / count;
  const center = column * index + column / 2;
  const half = (column * BAR_WIDTH) / 200;
  return { left: center - half, right: center + half };
}

function compactCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(Math.round(value));
}

function MetricSlotMenu({
  label,
  selectedKey,
  options,
  canRemove,
  labelFor,
  onSelect,
  onRemove,
}: {
  label: string;
  selectedKey: string;
  options: Array<{ key: string }>;
  canRemove: boolean;
  labelFor: (key: string) => string;
  onSelect: (key: string) => void;
  onRemove: () => void;
}) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = options.filter((item) => labelFor(item.key).toLowerCase().includes(needle));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#f0f2f5] px-2.5 text-xs font-medium text-[#1c1e21]"
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-2">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("digitalMarketing.metaAds.breakdownSearch", "Search field")}
            className="h-9 min-w-0 flex-1 rounded-lg bg-[#f0f2f5] px-3 text-sm text-[#1c1e21] outline-none placeholder:text-[#8a8d91]"
          />
          <button
            type="button"
            disabled={!canRemove}
            aria-label={t("common.delete", "Delete")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f2f5] text-[#1c1e21] disabled:opacity-40"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto border-t border-[#e5e7eb] pt-1">
          {filtered.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`flex w-full rounded-md px-2 py-2.5 text-left text-sm text-[#1c1e21] hover:bg-[#f7f8fa] ${
                item.key === selectedKey ? "bg-[#f0f2f5] font-medium" : ""
              }`}
              onClick={() => {
                onSelect(item.key);
                setOpen(false);
              }}
            >
              {labelFor(item.key)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddMetricMenu({
  options,
  labelFor,
  onAdd,
}: {
  options: Array<{ key: string }>;
  labelFor: (key: string) => string;
  onAdd: (key: string) => void;
}) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = options.filter((item) => labelFor(item.key).toLowerCase().includes(needle));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#f0f2f5] px-2.5 text-xs font-medium text-[#1c1e21]"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("digitalMarketing.metaAds.breakdownAdd", "Add")}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("digitalMarketing.metaAds.breakdownSearch", "Search field")}
          className="h-9 w-full rounded-lg bg-[#f0f2f5] px-3 text-sm text-[#1c1e21] outline-none placeholder:text-[#8a8d91]"
        />
        <div className="mt-2 max-h-64 overflow-y-auto border-t border-[#e5e7eb] pt-1">
          {filtered.map((item) => (
            <button
              key={item.key}
              type="button"
              className="flex w-full rounded-md px-2 py-2.5 text-left text-sm text-[#1c1e21] hover:bg-[#f7f8fa]"
              onClick={() => {
                onAdd(item.key);
                setOpen(false);
              }}
            >
              {labelFor(item.key)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function stepRate(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return (current / previous) * 100;
}

function changePercent(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function costPerAction(summary: MetaAdsAccountSummary | null, key: string): number | null {
  const count = readMetaAdsFunnelMetric(summary, key);
  if (!summary || count == null || count <= 0) return null;
  return summary.spend / count;
}

function ActionBarTip({
  dateLabel,
  label,
  value,
  previousValue,
  cost,
  previousCost,
  productValue,
  productValueKey,
  currency,
  compareLabel,
}: {
  dateLabel: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  cost: number | null;
  previousCost: number | null;
  productValue: number | null;
  productValueKey: "atc_conversion_value" | "purchase_conversion_value" | null;
  currency: string;
  compareLabel: string | null;
}) {
  const { t, dateLocale } = useAppTranslation();
  const countText =
    value == null
      ? "—"
      : new Intl.NumberFormat(dateLocale, { maximumFractionDigits: 0 }).format(value);
  const costText =
    cost == null
      ? "—"
      : new Intl.NumberFormat(dateLocale, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(cost);
  const countDelta = changePercent(value, previousValue);
  const costDelta = changePercent(cost, previousCost);

  return (
    <div className="w-[280px] text-left">
      <p className="text-center text-base font-semibold text-[#1c1e21]">{dateLabel}</p>
      <p className="mt-3 text-sm font-medium leading-5 text-[#1c1e21]">
        {label}: {countText}
      </p>
      <DeltaLine value={countDelta} compareLabel={compareLabel} />
      {productValue != null && productValueKey ? (
        <p className="mt-3 text-sm font-medium leading-5 text-[#1c1e21]">
          {t(
            productValueKey === "purchase_conversion_value"
              ? "digitalMarketing.metaAds.purchaseConversionValue"
              : "digitalMarketing.metaAds.atcConversionValue",
            productValueKey === "purchase_conversion_value" ? "Purchase conversion value" : "ATC conversion value",
          )}
          : {formatMetaMetricValue(productValueKey, productValue, currency)}
        </p>
      ) : null}
      <p className="mt-3 text-sm font-medium leading-5 text-[#1c1e21]">
        {t("digitalMarketing.metaAds.funnelActionCostPer", "Cost per {{metric}}", { metric: label })}: {costText}
      </p>
      <DeltaLine value={costDelta} compareLabel={compareLabel} invert />
    </div>
  );
}

function DeltaLine({
  value,
  compareLabel,
  invert = false,
}: {
  value: number | null;
  compareLabel: string | null;
  invert?: boolean;
}) {
  const { t } = useAppTranslation();
  if (value == null || !compareLabel) return null;
  const improved = invert ? value < 0 : value > 0;
  const color = value === 0 ? "text-[#65676b]" : improved ? "text-[#31a24c]" : "text-[#e41e3f]";
  return (
    <p className={`mt-0.5 text-sm font-medium ${color}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%{" "}
      <span className="font-normal text-[#65676b]">
        {t("digitalMarketing.metaAds.funnelCompareVsRange", "vs {{range}}", { range: compareLabel })}
      </span>
    </p>
  );
}

export function MetaAdsFunnelActionFlow({
  summary,
  previousSummary,
  loading,
  compareLabel,
  dateStart,
  dateEnd,
  metricKeys,
  onMetricKeysChange,
}: {
  summary: MetaAdsAccountSummary | null;
  previousSummary: MetaAdsAccountSummary | null;
  loading: boolean;
  compareLabel: string | null;
  dateStart: string;
  dateEnd: string;
  metricKeys: string[];
  onMetricKeysChange: (keys: string[]) => void;
}) {
  const { t, dateFnsLocale } = useAppTranslation();
  const dateLabel = useMemo(() => {
    const from = parseYmdLocal(dateStart);
    const to = parseYmdLocal(dateEnd);
    if (!from || !to) return "";
    const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
    if (sameMonth) {
      return `${format(from, "dd", { locale: dateFnsLocale })} - ${format(to, "dd MMM yyyy", { locale: dateFnsLocale })}`;
    }
    return `${format(from, "dd MMM yyyy", { locale: dateFnsLocale })} - ${format(to, "dd MMM yyyy", { locale: dateFnsLocale })}`;
  }, [dateStart, dateEnd, dateFnsLocale]);
  const currency = summary?.currency || previousSummary?.currency || "IDR";
  const copyRef = useRef<HTMLElement>(null);
  const options = useMemo(
    () => metaAdsFunnelMetricOptions().filter((item) => item.valueKind === "count"),
    [],
  );
  const labelFor = (key: string) => {
    const shared = SHARED_ITEM_LABELS[key];
    if (shared) return t(shared.key, shared.fallback);
    const option = options.find((item) => item.key === key);
    return option ? t(option.labelKey, option.defaultLabel) : key;
  };
  const stages = metricKeys.map((key) => ({
    key,
    label: labelFor(key),
    value: readMetaAdsFunnelMetric(summary, key),
    productValue:
      key === "adds_to_cart"
        ? readMetaAdsFunnelMetric(summary, "atc_conversion_value")
        : key === "purchases"
          ? readMetaAdsFunnelMetric(summary, "purchase_conversion_value")
          : null,
    productValueKey:
      key === "adds_to_cart"
        ? ("atc_conversion_value" as const)
        : key === "purchases"
          ? ("purchase_conversion_value" as const)
          : null,
  }));
  const max = stages.reduce((peak, stage) => Math.max(peak, stage.value ?? 0), 0);
  const heights = stages.map((stage) =>
    max > 0 && stage.value != null && stage.value > 0 ? (stage.value / max) * PLOT_HEIGHT : 0,
  );

  const setSlot = (index: number, key: string) => {
    const next = metricKeys.slice();
    const other = next.indexOf(key);
    if (other >= 0 && other !== index) next[other] = next[index];
    next[index] = key;
    onMetricKeysChange(next);
  };

  const addSlot = (key: string) => {
    if (metricKeys.length >= MAX_SLOTS || metricKeys.includes(key)) return;
    onMetricKeysChange([...metricKeys, key]);
  };

  const removeSlot = (index: number) => {
    if (metricKeys.length <= 1) return;
    onMetricKeysChange(metricKeys.filter((_, item) => item !== index));
  };

  return (
    <section ref={copyRef} className="relative z-0 flex h-full min-h-0 w-max min-w-[58rem] shrink-0 flex-col bg-white px-4 py-3">
      <div className="flex flex-nowrap items-center gap-2">
        {stages.map((stage, index) => (
          <MetricSlotMenu
            key={`${stage.key}-${index}`}
            label={stage.label}
            selectedKey={stage.key}
            options={options}
            canRemove={metricKeys.length > 1}
            labelFor={labelFor}
            onSelect={(next) => setSlot(index, next)}
            onRemove={() => removeSlot(index)}
          />
        ))}
        {metricKeys.length < MAX_SLOTS ? (
          <AddMetricMenu
            options={options.filter((item) => !metricKeys.includes(item.key))}
            labelFor={labelFor}
            onAdd={addSlot}
          />
        ) : null}
        <FunnelCopyButton targetRef={copyRef} disabled={loading} className="ml-auto" />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 items-stretch gap-3">
        <div className="flex h-full min-w-0 flex-1 flex-col">
          {loading ? (
            <div className="flex h-full items-end gap-6 px-4 pb-8">
              {[78, 36, 16].map((height) => (
                <div key={height} className="flex-1 animate-pulse rounded-t-sm bg-[#eef0f3]" style={{ height: `${height}%` }} />
              ))}
            </div>
          ) : (
            <>
            <TooltipProvider delayDuration={200}>
            <div className="relative z-0 min-h-0 flex-1">
              <svg
                className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                {stages.slice(0, -1).map((stage, index) => {
                  const current = barEdges(index, stages.length);
                  const next = barEdges(index + 1, stages.length);
                  const height = stage.value == null ? 0 : heights[index];
                  const nextHeight = stages[index + 1]?.value == null ? 0 : heights[index + 1];
                  const overlap = 0.6;
                  return (
                    <path
                      key={`${stage.key}-join-${index}`}
                      fill={CONNECTOR_COLOR}
                      d={connectorPath(
                        current.right - overlap,
                        100 - height,
                        next.left + overlap,
                        100 - nextHeight,
                      )}
                    />
                  );
                })}
              </svg>
              <div className="relative z-10 flex h-full">
              {stages.map((stage, index) => {
                const height = heights[index];
                return (
                  <div key={`${stage.key}-${index}`} className="relative h-full min-w-0 flex-1">
                    <span
                      className="absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1 whitespace-nowrap text-sm font-semibold"
                      style={{ bottom: `${height}%`, color: BAR_COLOR }}
                    >
                      {stage.value == null ? "—" : compactCount(stage.value)}
                    </span>
                    <div
                      className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2"
                      style={{
                        width: `${BAR_WIDTH}%`,
                        height: `${height}%`,
                        backgroundColor: BAR_COLOR,
                      }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 cursor-default"
                          style={{ width: `${BAR_WIDTH}%`, height: `max(${height}%, 28px)` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={10}
                        className="z-[80] overflow-visible rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-[#1c1e21] shadow-lg"
                      >
                        <ActionBarTip
                          dateLabel={dateLabel}
                          label={stage.label}
                          value={stage.value}
                          previousValue={readMetaAdsFunnelMetric(previousSummary, stage.key)}
                          cost={costPerAction(summary, stage.key)}
                          previousCost={costPerAction(previousSummary, stage.key)}
                          productValue={stage.productValue}
                          productValueKey={stage.productValueKey}
                          currency={currency}
                          compareLabel={compareLabel}
                        />
                        <span
                          className="absolute left-1/2 top-full -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-white"
                          aria-hidden
                        />
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
              </div>
              {stages.slice(0, -1).map((stage, index) => {
                const next = stages[index + 1];
                const rate = next ? stepRate(next.value, stage.value) : null;
                if (rate == null) return null;
                const current = barEdges(index, stages.length);
                const following = barEdges(index + 1, stages.length);
                const midX = (current.right + following.left) / 2;
                const midY = (heights[index] + heights[index + 1]) / 2;
                return (
                  <span
                    key={`${stage.key}-rate-${index}`}
                    className="absolute z-30 inline-flex h-[22px] -translate-x-1/2 translate-y-1/2 items-stretch"
                    style={{ left: `${midX}%`, bottom: `${midY}%` }}
                  >
                    <span className="inline-flex items-center rounded-l-[4px] bg-[#1c1e21] pl-2 pr-1 text-[11px] font-semibold leading-none text-white">
                      {rate.toFixed(2)}%
                    </span>
                    <svg width="11" height="22" viewBox="0 0 11 22" aria-hidden className="block shrink-0">
                      <path d="M0 0H1L11 11L1 22H0Z" fill="#1c1e21" />
                    </svg>
                  </span>
                );
              })}
            </div>
            </TooltipProvider>
            <div className="mt-2 flex shrink-0">
              {stages.map((stage, index) => (
                <div key={`${stage.key}-label-${index}`} className="min-w-0 flex-1 px-1 text-center">
                  <p className="truncate text-[11px] font-semibold leading-4 text-[#1c1e21]">
                    {stage.productValue != null && stage.productValueKey
                      ? formatMetaMetricValue(stage.productValueKey, stage.productValue, currency)
                      : "\u00a0"}
                  </p>
                  <p className="truncate text-[11px] text-[#65676b]">{stage.label}</p>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
