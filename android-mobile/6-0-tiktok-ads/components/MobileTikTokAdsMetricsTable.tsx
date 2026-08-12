import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import { formatTikTokMetricValue } from "@/tiktok-ads/metrics/formatTikTokMetricValue";
import type { TikTokAdsMetricCatalogItem } from "@/tiktok-ads/metrics/tiktokAdsMetricCatalog";
import {
  tiktokAdsRowDisplayName,
  tiktokAdsRowReactKey,
  tiktokAdsRowSecondaryName,
} from "@/tiktok-ads/metrics/tiktokAdsRowIdentity";

type Props = {
  entity: TikTokAdsMetricEntity;
  rows: TikTokAdsMetricsRow[];
  metricItems: TikTokAdsMetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
};

function formatServiceCpa(value: unknown, currencyCode: string | null): string {
  return formatTikTokMetricValue("spend", value, currencyCode);
}

/**
 * Mobile-only TikTok metrics table. Does not import desktop TikTokAdsMetricsTable.
 */
export function MobileTikTokAdsMetricsTable({
  entity,
  rows,
  metricItems,
  currencyCode,
  isLoading,
  emptyMessage,
  className,
}: Props) {
  const { t } = useAppTranslation();

  const identityCols = useMemo(() => {
    if (entity === "campaign") {
      return [
        { key: "service", label: t("digitalMarketing.tiktokAds.columnService", "Service") },
        { key: "service_cpl", label: t("digitalMarketing.tiktokAds.columnCostPerLead", "CPA") },
        {
          key: "service_converted_leads",
          label: t("digitalMarketing.tiktokAds.columnConvertedLeads", "Conv. leads"),
        },
        { key: "name", label: t("digitalMarketing.tiktokAds.name", "Name") },
      ] as const;
    }
    if (entity === "adgroup") {
      return [
        { key: "name", label: t("digitalMarketing.tiktokAds.name", "Name") },
        { key: "campaign", label: t("digitalMarketing.tiktokAds.campaignColumn", "Campaign") },
      ] as const;
    }
    return [
      { key: "name", label: t("digitalMarketing.tiktokAds.name", "Name") },
      { key: "adgroup", label: t("digitalMarketing.tiktokAds.adgroupColumn", "Ad group") },
    ] as const;
  }, [entity, t]);

  const thClass =
    "sticky top-0 z-10 whitespace-nowrap border-b border-border bg-muted/80 px-3 py-2 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm";
  const tdClass = "whitespace-nowrap border-b border-border/60 px-3 py-2.5 text-sm align-middle";

  if (isLoading) {
    return (
      <div
        className={cn("-mx-2 overflow-hidden border-y border-border bg-card", className)}
        aria-busy
        aria-label={t("digitalMarketing.tiktokAds.summaryLoading", "Loading summary metrics")}
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
        {emptyMessage ?? t("digitalMarketing.tiktokAds.noData", "No data for this period")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "-mx-2 overflow-x-auto overflow-y-hidden border-y border-border bg-card [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
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
                  (col.key === "service_cpl" || col.key === "service_converted_leads") &&
                    "text-right",
                )}
              >
                {col.label}
              </th>
            ))}
            {metricItems.map((m) => (
              <th key={m.key} className={cn(thClass, "text-right")}>
                {t(m.labelKey, m.defaultLabel)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const r = row as Record<string, unknown>;
            return (
              <tr key={tiktokAdsRowReactKey(row, entity, i)} className="bg-card">
                {identityCols.map((col) => {
                  let text = "—";
                  if (col.key === "service") {
                    text = String(r.service_name ?? "").trim() || "—";
                  } else if (col.key === "service_cpl") {
                    text = formatServiceCpa(r.service_cpl, currencyCode);
                  } else if (col.key === "service_converted_leads") {
                    const n = r.service_converted_leads;
                    text =
                      n != null && Number.isFinite(Number(n)) ? String(Number(n)) : "—";
                  } else if (col.key === "name") {
                    text = tiktokAdsRowDisplayName(row, entity);
                  } else if (col.key === "campaign" || col.key === "adgroup") {
                    text = tiktokAdsRowSecondaryName(row, entity) ?? "—";
                  }
                  const alignRight =
                    col.key === "service_cpl" || col.key === "service_converted_leads";
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
                {metricItems.map((m) => (
                  <td
                    key={m.key}
                    className={cn(tdClass, "text-right tabular-nums")}
                  >
                    {formatTikTokMetricValue(m.key, r[m.key], currencyCode, {
                      ctrSource: m.key === "ctr" ? "api" : undefined,
                    })}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
