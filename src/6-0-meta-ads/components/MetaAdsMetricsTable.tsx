import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import type { MetaAdsMetricCatalogItem } from "@/meta-ads/metrics/metaAdsMetricCatalog";
import {
  metaAdsRowDisplayName,
  metaAdsRowReactKey,
  metaAdsRowSecondaryName,
} from "@/meta-ads/metrics/metaAdsRowIdentity";

export const metaAdsMetricsTableScrollClass = cn(
  "nested-scroll-touch-chain seamless-scroll min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto",
);

const thBase =
  "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle text-sm font-medium text-muted-foreground";

type Props = {
  entity: MetaAdsMetricEntity;
  rows: MetaAdsMetricsRow[];
  metricItems: MetaAdsMetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
};

export function MetaAdsMetricsTable({
  entity,
  rows,
  metricItems,
  currencyCode,
  isLoading,
  emptyMessage,
}: Props) {
  const { t } = useTranslation();

  const identityHeaders: { key: string; label: string }[] =
    entity === "campaign"
      ? [{ key: "name", label: t("digitalMarketing.metaAds.name", "Name") }]
      : entity === "adset"
        ? [
            { key: "name", label: t("digitalMarketing.metaAds.name", "Name") },
            {
              key: "campaign",
              label: t("digitalMarketing.metaAds.campaignColumn", "Campaign"),
            },
          ]
        : [
            { key: "name", label: t("digitalMarketing.metaAds.name", "Name") },
            {
              key: "adset",
              label: t("digitalMarketing.metaAds.adsetColumn", "Ad set"),
            },
          ];

  const colSpan = identityHeaders.length + metricItems.length;
  const metricColClass = "min-w-[5.5rem] whitespace-nowrap px-3 text-right";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className={metaAdsMetricsTableScrollClass}>
        <table className="w-max min-w-full caption-bottom border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <tr className="border-b border-border hover:bg-transparent">
              {identityHeaders.map((h) => (
                <th
                  key={h.key}
                  className={cn(thBase, h.key === "name" ? "min-w-[10rem]" : "min-w-[6.5rem]")}
                >
                  {h.label}
                </th>
              ))}
              {metricItems.map((m) => (
                <th key={m.key} className={cn(thBase, metricColClass, "text-right")}>
                  {t(m.labelKey, m.defaultLabel)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="py-16 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("digitalMarketing.metaAds.tableLoading", "Loading metrics…")}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-16 text-center text-sm text-muted-foreground">
                  {emptyMessage ?? t("digitalMarketing.metaAds.noData", "No data for this period")}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const r = row as Record<string, unknown>;
                const secondary = metaAdsRowSecondaryName(row, entity);
                return (
                  <tr
                    key={metaAdsRowReactKey(row, entity, i)}
                    className="border-b border-border transition-colors hover:bg-muted/50"
                  >
                    <td className="max-w-[280px] truncate p-2 align-middle font-medium">
                      {metaAdsRowDisplayName(row, entity)}
                    </td>
                    {entity !== "campaign" ? (
                      <td className="max-w-[200px] truncate p-2 align-middle text-muted-foreground">
                        {secondary ?? "—"}
                      </td>
                    ) : null}
                    {metricItems.map((m) => (
                      <td
                        key={m.key}
                        className={cn("p-2 align-middle tabular-nums", metricColClass)}
                      >
                        {formatMetaMetricValue(m.key, r[m.key], currencyCode, {
                          ctrSource: m.key === "ctr" ? "api" : undefined,
                        })}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
