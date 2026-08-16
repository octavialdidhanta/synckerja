import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import {
  GOOGLE_ADS_IDENTITY_COLUMNS,
  GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS,
  isGoogleAdsPinnedMetricKey,
  isOptionalIdentityColumnKey,
  stripGoogleAdsPinnedMetricKeys,
} from "@/google-ads/metrics/googleAdsIdentityColumns";
import { LEADS_VISIT_RATE_KEY } from "@/google-ads/metrics/googleAdsSynckerjaLeadsMetrics";
import { TRAFFIC_VISIT_CLICK_RATE_KEY } from "@/google-ads/metrics/googleAdsSynckerjaTrafficMetrics";
import { leadsVisitRateCellStyle } from "@/google-ads/metrics/leadsVisitRateCellStyle";
import { trafficVisitClickRateCellStyle } from "@/google-ads/metrics/trafficVisitClickRateCellStyle";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsMetricsRow,
  MetricCatalogItem,
} from "@/google-ads/metrics/types";

type Props = {
  entity: GoogleAdsMetricEntity;
  rows: GoogleAdsMetricsRow[];
  selectedColumnKeys: string[];
  metricItems: MetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
};

function formatServiceCpa(
  value: unknown,
  currencyCode: string | null | undefined,
): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return formatMetricValue("spent", Number(value), currencyCode ?? "IDR", "micros");
}

function identityCellText(
  entity: GoogleAdsMetricEntity,
  key: string,
  row: GoogleAdsMetricsRow,
  currencyCode: string | null,
): string {
  const id = row.identity;
  switch (key) {
    case "spent":
      return formatMetricValue("spent", row.metrics.spent, currencyCode, "micros");
    case "name":
      return String(id.name ?? "—");
    case "service":
      return String(id.service_name ?? "—");
    case "service_cpl":
      return formatServiceCpa(id.service_cpl, currencyCode);
    case "service_converted_leads": {
      const converted = id.service_converted_leads;
      return converted != null && Number.isFinite(Number(converted))
        ? String(Number(converted))
        : "—";
    }
    case "status":
      return String(id.status ?? "—");
    case "channel":
      return String(id.channel_type ?? "—");
    case "campaign":
      return String(id.campaign_name ?? "—");
    case "ad_group":
      return String(id.ad_group_name ?? "—");
    case "keyword":
      return String(id.keyword_text ?? "—");
    case "match_type":
      return String(id.match_type ?? "—");
    default:
      return "—";
  }
}

/**
 * Mobile-only metrics table (horizontal scroll, full-bleed friendly).
 * Column order / labels come from the same preference keys + catalog as desktop.
 * Does not import desktop `GoogleAdsMetricsTable`.
 */
export function MobileGoogleAdsMetricsTable({
  entity,
  rows,
  selectedColumnKeys,
  metricItems,
  currencyCode,
  isLoading,
  emptyMessage,
  className,
}: Props) {
  const { t } = useTranslation();
  const metricByKey = useMemo(
    () => new Map(metricItems.filter((m) => !isGoogleAdsPinnedMetricKey(m.key)).map((m) => [m.key, m])),
    [metricItems],
  );
  const optionalLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS[entity]) {
      map.set(col.key, col.label);
    }
    return map;
  }, [entity]);

  const lockedCols = GOOGLE_ADS_IDENTITY_COLUMNS[entity];

  const displayMetricCols = useMemo(() => {
    return stripGoogleAdsPinnedMetricKeys(selectedColumnKeys)
      .map((key) => {
        if (isOptionalIdentityColumnKey(entity, key)) {
          return {
            kind: "optional_identity" as const,
            key,
            label: optionalLabelByKey.get(key) ?? key,
          };
        }
        const metric = metricByKey.get(key);
        if (!metric) return null;
        return { kind: "metric" as const, metric };
      })
      .filter((c): c is NonNullable<typeof c> => c != null);
  }, [selectedColumnKeys, entity, metricByKey, optionalLabelByKey]);

  const thClass =
    "sticky top-0 z-10 whitespace-nowrap border-b border-border bg-muted/80 px-3 py-2 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm";
  const tdClass = "whitespace-nowrap border-b border-border/60 px-3 py-2.5 text-sm align-middle";

  if (isLoading) {
    return (
      <div
        className={cn("-mx-2 overflow-hidden border-y border-border bg-card", className)}
        aria-busy
        aria-label={t("digitalMarketing.googleAds.summaryLoading", "Loading summary metrics")}
      >
        <div className="space-y-0 p-3">
          <div className="mb-3 flex gap-3">
            <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-14 animate-pulse rounded bg-muted/40" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-3 w-28 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-10 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-14 animate-pulse rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "-mx-2 border-y border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyMessage ?? t("common.noData", "No data")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "-mx-2 min-w-0 border-y border-border bg-card",
        className,
      )}
    >
      <div
        className={cn(
          "nested-scroll-touch-chain-xy scrollbar-hide min-w-0 w-full overflow-x-auto overflow-y-hidden",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {lockedCols.map((col) => (
              <th
                key={col.key}
                className={cn(
                  thClass,
                  (col.key === "service_cpl" ||
                    col.key === "service_converted_leads" ||
                    col.key === "spent") &&
                    "text-right",
                )}
              >
                {col.key === "service"
                  ? t("digitalMarketing.googleAds.columnService", "Service")
                  : col.key === "service_cpl"
                    ? t("digitalMarketing.googleAds.columnCostPerLead", "CPA")
                  : col.key === "service_converted_leads"
                    ? t("digitalMarketing.googleAds.columnConvertedLeads", "Conv. leads")
                    : col.key === "spent"
                      ? t("digitalMarketing.googleAds.summaryCost", "Cost")
                      : col.label}
              </th>
            ))}
            {displayMetricCols.map((col) =>
              col.kind === "metric" ? (
                <th key={col.metric.key} className={cn(thClass, "text-right")}>
                  {col.metric.label}
                </th>
              ) : (
                <th key={col.key} className={thClass}>
                  {col.label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="bg-card">
              {lockedCols.map((col) => {
                const text = identityCellText(entity, col.key, row, currencyCode);
                const alignRight =
                  col.key === "service_cpl" ||
                  col.key === "service_converted_leads" ||
                  col.key === "spent";
                return (
                  <td
                    key={col.key}
                    className={cn(
                      tdClass,
                      alignRight && "text-right tabular-nums",
                      col.key === "name" && "max-w-[11rem] truncate font-medium",
                      col.key === "service" && "max-w-[8rem] truncate",
                    )}
                    title={text}
                  >
                    {text}
                  </td>
                );
              })}
              {displayMetricCols.map((col) => {
                if (col.kind === "optional_identity") {
                  const text = identityCellText(entity, col.key, row, currencyCode);
                  return (
                    <td key={col.key} className={tdClass} title={text}>
                      {text}
                    </td>
                  );
                }
                const raw = row.metrics[col.metric.key];
                const formatted = formatMetricValue(
                  col.metric.key,
                  raw,
                  currencyCode,
                  col.metric.valueKind,
                );
                const rateStyle =
                  col.metric.key === TRAFFIC_VISIT_CLICK_RATE_KEY
                    ? trafficVisitClickRateCellStyle(raw)
                    : col.metric.key === LEADS_VISIT_RATE_KEY
                      ? leadsVisitRateCellStyle(raw)
                      : undefined;
                return (
                  <td
                    key={col.metric.key}
                    className={cn(tdClass, "text-right tabular-nums")}
                    style={rateStyle}
                  >
                    {formatted}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
