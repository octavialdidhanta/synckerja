import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import {
  getMetaAdsLockedTableColumns,
  isMetaAdsPinnedMetricKey,
  type MetaAdsMetricCatalogItem,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";
import {
  metaAdsRowDisplayName,
  metaAdsRowReactKey,
  metaAdsRowSecondaryName,
} from "@/meta-ads/metrics/metaAdsRowIdentity";

type Props = {
  entity: MetaAdsMetricEntity;
  rows: MetaAdsMetricsRow[];
  metricItems: MetaAdsMetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
};

function formatServiceCpa(value: unknown, currencyCode: string | null): string {
  return formatMetaMetricValue("spend", value, currencyCode);
}

function identityCellText(
  entity: MetaAdsMetricEntity,
  key: string,
  row: MetaAdsMetricsRow,
  currencyCode: string | null,
): string {
  const r = row as Record<string, unknown>;
  switch (key) {
    case "spend":
      return formatMetaMetricValue("spend", r.spend, currencyCode);
    case "service":
      return String(r.service_name ?? "").trim() || "—";
    case "service_cpl":
      return formatServiceCpa(r.service_cpl, currencyCode);
    case "service_converted_leads": {
      const n = r.service_converted_leads;
      return n != null && Number.isFinite(Number(n)) ? String(Number(n)) : "—";
    }
    case "name":
      return metaAdsRowDisplayName(row, entity);
    case "campaign_name":
    case "campaign":
    case "adset_name":
    case "adset":
      return metaAdsRowSecondaryName(row, entity) ?? "—";
    default:
      return "—";
  }
}

/**
 * Mobile-only Meta metrics table. Does not import desktop MetaAdsMetricsTable.
 */
export function MobileMetaAdsMetricsTable({
  entity,
  rows,
  metricItems,
  currencyCode,
  isLoading,
  emptyMessage,
  className,
}: Props) {
  const { t } = useAppTranslation();

  const identityCols = useMemo(
    () =>
      getMetaAdsLockedTableColumns(entity).map((col) => ({
        key: col.key,
        label: t(col.labelKey, col.defaultLabel),
      })),
    [entity, t],
  );
  const visibleMetricItems = useMemo(
    () => metricItems.filter((m) => !isMetaAdsPinnedMetricKey(m.key)),
    [metricItems],
  );

  const thClass =
    "sticky top-0 z-10 whitespace-nowrap border-b border-border bg-muted/80 px-3 py-2 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm";
  const tdClass = "whitespace-nowrap border-b border-border/60 px-3 py-2.5 text-sm align-middle";

  if (isLoading) {
    return (
      <div
        className={cn("-mx-2 overflow-hidden border-y border-border bg-card", className)}
        aria-busy
        aria-label={t("digitalMarketing.metaAds.summaryLoading", "Loading summary metrics")}
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
        {emptyMessage ?? t("digitalMarketing.metaAds.noData", "No data for this period")}
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
            {identityCols.map((col) => (
              <th
                key={col.key}
                className={cn(
                  thClass,
                  (col.key === "service_cpl" ||
                    col.key === "service_converted_leads" ||
                    col.key === "spend") &&
                    "text-right",
                )}
              >
                {col.label}
              </th>
            ))}
            {visibleMetricItems.map((m) => (
              <th key={m.key} className={cn(thClass, "text-right")}>
                {t(m.labelKey, m.defaultLabel)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={metaAdsRowReactKey(row, entity, i)} className="bg-card">
              {identityCols.map((col) => {
                const text = identityCellText(entity, col.key, row, currencyCode);
                const alignRight =
                  col.key === "service_cpl" ||
                  col.key === "service_converted_leads" ||
                  col.key === "spend";
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
              {visibleMetricItems.map((m) => {
                const r = row as Record<string, unknown>;
                return (
                  <td
                    key={m.key}
                    className={cn(tdClass, "text-right tabular-nums")}
                  >
                    {formatMetaMetricValue(m.key, r[m.key], currencyCode, {
                      ctrSource: m.key === "ctr" ? "api" : undefined,
                    })}
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
