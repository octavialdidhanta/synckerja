import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, ChevronDown, Plus, Table2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import {
  BREAKDOWN_MAX_SLOTS,
  BREAKDOWN_METRIC_COLORS,
  BREAKDOWN_METRIC_KEYS,
  BREAKDOWN_METRIC_LABELS,
  BREAKDOWN_NONE_COLOR,
  formatBreakdownDisplay,
  type BreakdownMetricKey,
  type BreakdownMetricSlot,
} from "@/meta-ads/breakdown/metaAdsBreakdownMetrics";
import {
  useMetaAdsDemographicBreakdown,
  type MetaAdsDemographicBucket,
} from "@/meta-ads/hooks/useMetaAdsDemographicBreakdown";
import { MetaAdsBreakdownChart } from "@/6-0-meta-ads/components/breakdown/MetaAdsBreakdownChart";

type BreakdownKind = "age" | "gender" | "region" | "device" | "publisher" | "day" | "hour";

const REGION_PAGE_SIZE = 6;
type CardView = "chart" | "table";

function slotColor(slots: BreakdownMetricSlot[], index: number): string {
  const slot = slots[index];
  if (!slot || slot === "none") return BREAKDOWN_NONE_COLOR;
  const selectedIndex = slots.slice(0, index + 1).filter((item) => item !== "none").length - 1;
  return BREAKDOWN_METRIC_COLORS[selectedIndex] ?? BREAKDOWN_METRIC_COLORS[BREAKDOWN_METRIC_COLORS.length - 1];
}

function MetricSlotPicker({
  value,
  color,
  taken,
  onChange,
}: {
  value: BreakdownMetricSlot;
  color: string;
  taken: BreakdownMetricKey[];
  onChange: (next: BreakdownMetricSlot) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const labelFor = (slot: BreakdownMetricSlot) => {
    if (slot === "none") return t("digitalMarketing.metaAds.breakdownNone", "None");
    const meta = BREAKDOWN_METRIC_LABELS[slot];
    return t(meta.labelKey, meta.defaultLabel);
  };
  const options: BreakdownMetricSlot[] = [
    "none",
    ...BREAKDOWN_METRIC_KEYS.filter((key) => key === value || !taken.includes(key)),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-8 gap-2 rounded-lg bg-[#f0f2f5] px-2.5 text-[13px] font-medium text-[#1c1e21] hover:bg-[#e4e6eb]"
        >
          <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
          <span className="max-w-[11rem] truncate">{labelFor(value)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command>
          <CommandInput
            placeholder={t("digitalMarketing.metaAds.breakdownSearch", "Search field")}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>{t("digitalMarketing.metaAds.breakdownNoMatch", "No field found")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={labelFor(option)}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {labelFor(option)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function BreakdownCard({
  kind,
  title,
  rows,
  metrics,
  currency,
  loading,
  errorMessage,
  labelFor,
  widthClass = "w-[560px]",
  badge,
  compactLabels = false,
}: {
  kind: BreakdownKind;
  title: string;
  rows: MetaAdsDemographicBucket[];
  metrics: Array<{ metric: BreakdownMetricKey; color: string; label: string }>;
  currency: string | null;
  loading: boolean;
  errorMessage: string | null;
  labelFor: (key: string) => string;
  widthClass?: string;
  badge?: string;
  compactLabels?: boolean;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<CardView>("chart");
  const [page, setPage] = useState(0);
  const rowSignature = rows.map((row) => row.key).join("|");
  useEffect(() => {
    setPage(0);
  }, [rowSignature]);
  const pageSize = kind === "region" ? REGION_PAGE_SIZE : Math.max(rows.length, 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const chartLabel = t("digitalMarketing.metaAds.breakdownChart", "Chart");
  const tableLabel = t("digitalMarketing.metaAds.breakdownTable", "Table");

  return (
    <section
      className={cn(
        "flex min-h-[280px] shrink-0 flex-col rounded-lg border border-[#dddfe2] bg-white p-4",
        widthClass,
      )}
      style={kind === "region" && view === "chart" ? { width: Math.max(560, rows.length * 104) } : undefined}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-bold text-[#1c1e21]">{title}</h3>
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-[#f0f2f5] px-2 py-0.5 text-[11px] font-medium text-[#1c1e21]">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="flex items-center rounded-lg border border-[#dddfe2] p-0.5">
          <button
            type="button"
            aria-label={chartLabel}
            aria-pressed={view === "chart"}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded-md text-[#1c1e21]",
              view === "chart" ? "bg-[#f0f2f5]" : "hover:bg-[#f7f8fa]",
            )}
            onClick={() => setView("chart")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={tableLabel}
            aria-pressed={view === "table"}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded-md text-[#1c1e21]",
              view === "table" ? "bg-[#f0f2f5]" : "hover:bg-[#f7f8fa]",
            )}
            onClick={() => setView("table")}
          >
            <Table2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[220px] items-end gap-3 px-6 pb-6" aria-hidden>
          {(kind === "age" ? [42, 88, 36, 18, 10, 12] : kind === "region" ? [70, 40, 55, 24, 48, 33] : [38, 86]).map((height, index) => (
            <div
              key={index}
              className="flex-1 animate-pulse rounded-sm bg-[#eef0f3]"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <p className="py-8 text-sm text-[#65676b]">{errorMessage}</p>
      ) : null}

      {!loading && !errorMessage && metrics.length === 0 && kind !== "region" ? (
        <div className="min-h-[180px] flex-1" />
      ) : null}

      {!loading && !errorMessage && metrics.length > 0 && rows.length === 0 ? (
        <p className="py-8 text-sm text-[#65676b]">
          {t("digitalMarketing.metaAds.noData", "No data for this period")}
        </p>
      ) : null}

      {!loading && !errorMessage && metrics.length > 0 && rows.length > 0 && view === "chart"
        ? metrics.map((item) => (
            <div key={item.metric} className="min-w-0">
              <p className="mb-1 text-xs font-bold text-[#1c1e21]">{item.label}</p>
              <MetaAdsBreakdownChart
                rows={rows}
                metric={item.metric}
                color={item.color}
                currency={currency}
                labelFor={labelFor}
                compactLabels={compactLabels}
              />
            </div>
          ))
        : null}

      {!loading && !errorMessage && rows.length > 0 && view === "table" && (metrics.length > 0 || kind === "region") ? (
        <div className="min-w-0">
          <div>
            <table className="w-full min-w-[280px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#f0f2f5] text-left text-sm text-[#1c1e21]">
                  <th className="px-3 py-3 font-bold">{title}</th>
                  {metrics.map((item) => (
                    <th key={item.metric} className="px-3 py-3 text-right font-bold">
                      {item.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.key} className="border-b border-[#f0f2f5]">
                    <td className="px-3 py-3 text-[#1c1e21]">{labelFor(row.key)}</td>
                    {metrics.map((item) => (
                      <td key={item.metric} className="px-3 py-3 text-right tabular-nums text-[#1c1e21]">
                        {formatBreakdownDisplay(item.metric, row[item.metric], currency, false)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {kind === "region" ? (
            <div className="mt-2 flex items-center justify-between gap-3 px-1 text-sm">
              <span className="font-medium text-[#1c1e21]">
                {t("digitalMarketing.metaAds.breakdownPage", "Page : {{current}} of {{total}}", {
                  current: currentPage + 1,
                  total: pageCount,
                })}
              </span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  className="font-medium text-[#1877F2] disabled:opacity-40"
                  disabled={currentPage === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  {t("digitalMarketing.metaAds.breakdownPrev", "Prev")}
                </button>
                <button
                  type="button"
                  className="font-medium text-[#1877F2] disabled:opacity-40"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                >
                  {t("digitalMarketing.metaAds.breakdownNext", "Next")}
                </button>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function MetaAdsBreakdownPage({
  organizationId,
  adAccountId,
  dateStart,
  dateEnd,
  campaignIds,
  adsetIds,
  adIds,
  enabled,
}: {
  organizationId: string | null | undefined;
  adAccountId: string;
  dateStart: string;
  dateEnd: string;
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<BreakdownMetricSlot[]>(["impressions"]);
  const query = useMetaAdsDemographicBreakdown({
    organizationId,
    adAccountId,
    dateStart,
    dateEnd,
    campaignIds,
    adsetIds,
    adIds,
    enabled,
  });

  const labelForMetric = (metric: BreakdownMetricKey) => {
    const meta = BREAKDOWN_METRIC_LABELS[metric];
    return t(meta.labelKey, meta.defaultLabel);
  };
  const labelForBucket = (kind: BreakdownKind, key: string) => {
    if (key === "female") return t("digitalMarketing.metaAds.breakdownFemale", "Female");
    if (key === "male") return t("digitalMarketing.metaAds.breakdownMale", "Male");
    if (key === "unknown" || key === "Unknown") {
      return t("digitalMarketing.metaAds.breakdownUnknown", "Unknown");
    }
    if (kind === "device") {
      if (key === "desktop") return t("digitalMarketing.metaAds.breakdownDesktop", "Desktop");
      if (key === "mobile_app") return t("digitalMarketing.metaAds.breakdownMobileApp", "Mobile App");
      if (key === "mobile_web") return t("digitalMarketing.metaAds.breakdownMobileWeb", "Mobile Web");
    }
    if (kind === "publisher") {
      if (key === "audience_network") return t("digitalMarketing.metaAds.breakdownAudienceNetwork", "Audience Network");
      if (key === "facebook") return t("digitalMarketing.metaAds.breakdownFacebook", "Facebook");
      if (key === "instagram") return t("digitalMarketing.metaAds.breakdownInstagram", "Instagram");
      if (key === "messenger") return t("digitalMarketing.metaAds.breakdownMessenger", "Messenger");
      if (key === "threads") return t("digitalMarketing.metaAds.breakdownThreads", "Threads");
    }
    if (kind === "day") {
      if (key === "sun") return t("digitalMarketing.metaAds.breakdownSunday", "Sunday");
      if (key === "mon") return t("digitalMarketing.metaAds.breakdownMonday", "Monday");
      if (key === "tue") return t("digitalMarketing.metaAds.breakdownTuesday", "Tuesday");
      if (key === "wed") return t("digitalMarketing.metaAds.breakdownWednesday", "Wednesday");
      if (key === "thu") return t("digitalMarketing.metaAds.breakdownThursday", "Thursday");
      if (key === "fri") return t("digitalMarketing.metaAds.breakdownFriday", "Friday");
      if (key === "sat") return t("digitalMarketing.metaAds.breakdownSaturday", "Saturday");
    }
    return key;
  };
  const sideError = (ready: boolean | undefined, detail: string | null | undefined, unavailable: string) => {
    if (detail) return detail;
    if (ready === false) return unavailable;
    return null;
  };
  const selected = slots.flatMap((slot, index) => {
    if (slot === "none") return [];
    return [{ metric: slot, color: slotColor(slots, index), label: labelForMetric(slot) }];
  });
  const loading = enabled && query.isLoading && !query.data;
  const rawError = !query.data && query.error instanceof Error ? query.error.message : null;
  const errorMessage =
    rawError === "BREAKDOWN_UNAVAILABLE"
      ? t(
          "digitalMarketing.metaAds.breakdownUnavailable",
          "Age and gender breakdown is not available from the server yet.",
        )
      : rawError;
  const currency = query.data?.currency ?? null;

  if (!adAccountId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-white px-4 text-sm text-[#65676b]">
        {t("digitalMarketing.metaAds.breakdownSelectAccount", "Select an ad account")}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-sm font-bold text-[#1c1e21]">
          {t("digitalMarketing.metaAds.breakdownBy", "Breakdown By")}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {slots.map((slot, index) => (
            <MetricSlotPicker
              key={`${index}-${slot}`}
              value={slot}
              color={slotColor(slots, index)}
              taken={slots.filter((item): item is BreakdownMetricKey => item !== "none" && item !== slot)}
              onChange={(next) => {
                setSlots((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)));
              }}
            />
          ))}
          {slots.length < BREAKDOWN_MAX_SLOTS ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-lg border-[#dddfe2] px-3 text-[13px] font-medium text-[#1c1e21]"
              onClick={() => setSlots((current) => [...current, "none"])}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("digitalMarketing.metaAds.breakdownAdd", "Add")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className={cn(
          "flex w-max min-w-full items-start gap-3 px-4 pb-4",
          query.isFetching && query.data ? "opacity-80" : "",
        )}
      >
        <BreakdownCard
          kind="age"
          title={t("digitalMarketing.metaAds.audienceAge", "Age")}
          rows={query.data?.age ?? []}
          metrics={selected}
          currency={currency}
          loading={loading}
          errorMessage={errorMessage}
          labelFor={(key) => labelForBucket("age", key)}
        />
        <BreakdownCard
          kind="gender"
          title={t("digitalMarketing.metaAds.audienceGender", "Gender")}
          rows={query.data?.gender ?? []}
          metrics={selected}
          currency={currency}
          loading={loading}
          errorMessage={errorMessage}
          labelFor={(key) => labelForBucket("gender", key)}
        />
        <BreakdownCard
          kind="region"
          title={t("digitalMarketing.metaAds.breakdownRegion", "Region")}
          rows={query.data?.region ?? []}
          metrics={selected}
          currency={currency}
          loading={loading}
          errorMessage={
            errorMessage ??
            query.data?.regionError ??
            (query.data && !query.data.regionReady
              ? t(
                  "digitalMarketing.metaAds.breakdownRegionUnavailable",
                  "Region is not available from the server yet.",
                )
              : null)
          }
          labelFor={(key) => labelForBucket("region", key)}
        />
        <BreakdownCard
          kind="device"
          title={t("digitalMarketing.metaAds.breakdownDevice", "Device")}
          rows={query.data?.device ?? []}
          metrics={selected}
          currency={currency}
          loading={loading}
          widthClass="w-[480px]"
          errorMessage={errorMessage ?? sideError(
            query.data?.deviceReady,
            query.data?.deviceError,
            t("digitalMarketing.metaAds.breakdownDeviceUnavailable", "Device is not available from the server yet."),
          )}
          labelFor={(key) => labelForBucket("device", key)}
        />
        <BreakdownCard
          kind="publisher"
          title={t("digitalMarketing.metaAds.breakdownPublisher", "Publisher")}
          rows={query.data?.publisher ?? []}
          metrics={selected}
          currency={currency}
          loading={loading}
          widthClass="w-[480px]"
          errorMessage={errorMessage ?? sideError(
            query.data?.publisherReady,
            query.data?.publisherError,
            t("digitalMarketing.metaAds.breakdownPublisherUnavailable", "Publisher is not available from the server yet."),
          )}
          labelFor={(key) => labelForBucket("publisher", key)}
        />
        <BreakdownCard
          kind="day"
          title={t("digitalMarketing.metaAds.breakdownDay", "Day")}
          rows={query.data?.day ?? []}
          metrics={selected}
          currency={currency}
          loading={loading}
          widthClass="w-[520px]"
          errorMessage={errorMessage ?? sideError(
            query.data?.dayReady,
            query.data?.dayError,
            t("digitalMarketing.metaAds.breakdownDayUnavailable", "Day is not available from the server yet."),
          )}
          labelFor={(key) => labelForBucket("day", key)}
        />
        <BreakdownCard
          kind="hour"
          title={t("digitalMarketing.metaAds.breakdownHour", "Hour")}
          badge={t("digitalMarketing.metaAds.breakdownAdvertiserTimezone", "Advertiser Timezone")}
          rows={query.data?.hour ?? []}
          metrics={selected}
          currency={currency}
          loading={loading}
          widthClass="w-[920px]"
          compactLabels
          errorMessage={errorMessage ?? sideError(
            query.data?.hourReady,
            query.data?.hourError,
            t("digitalMarketing.metaAds.breakdownHourUnavailable", "Hour is not available from the server yet."),
          )}
          labelFor={(key) => labelForBucket("hour", key)}
        />
      </div>
      </div>
    </div>
  );
}
