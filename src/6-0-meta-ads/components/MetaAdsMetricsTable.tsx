import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
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

type ServiceOption = { id: string; name: string };

type IdentityCol = {
  key: string;
  label: string;
  headerTitle?: string;
  cellClassName?: string;
  render: (row: MetaAdsMetricsRow) => ReactNode;
};

function formatServiceCpa(value: unknown, currencyCode: string | null | undefined): string {
  return formatMetaMetricValue("spend", value, currencyCode);
}

function campaignIdentityColumns(
  t: (key: string, defaultValue?: string) => string,
  opts: {
    canEditServiceMapping: boolean;
    services: ServiceOption[];
    onServiceMappingChange?: (row: MetaAdsMetricsRow, serviceId: string | null) => void;
    serviceMappingPending: boolean;
    currencyCode: string | null;
  },
): IdentityCol[] {
  const cpaTip = t(
    "digitalMarketing.metaAds.serviceAggregateTip",
    "CPA per campaign: spent campaign ini dibagi lead Converted yang UTM campaign-nya cocok dengan nama campaign Meta (wajib fbclid; converted_at dalam rentang tanggal). CPL untuk lead yang belum converted.",
  );

  return [
    {
      key: "service",
      label: t("digitalMarketing.metaAds.columnService", "Service"),
      cellClassName: "min-w-[9rem] max-w-[200px]",
      render: (row) => {
        const r = row as Record<string, unknown>;
        const displayName = String(r.service_name ?? "").trim();
        if (!opts.canEditServiceMapping) {
          return displayName || "—";
        }
        const currentId = String(r.service_id ?? "").trim();
        return (
          <Select
            value={currentId || "__none__"}
            disabled={opts.serviceMappingPending}
            onValueChange={(value) => {
              const next = value === "__none__" ? null : value;
              opts.onServiceMappingChange?.(row, next);
            }}
          >
            <SelectTrigger className="h-8 w-full max-w-[200px] text-xs">
              <SelectValue placeholder={t("digitalMarketing.metaAds.selectService", "Pilih service")}>
                {currentId ? displayName || currentId : "—"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {opts.services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      key: "service_cpl",
      label: t("digitalMarketing.metaAds.columnCostPerLead", "CPA"),
      headerTitle: cpaTip,
      cellClassName: "whitespace-nowrap text-right tabular-nums text-sm",
      render: (row) => {
        const r = row as Record<string, unknown>;
        const text = formatServiceCpa(r.service_cpl, opts.currencyCode);
        const converted = r.service_converted_leads;
        const convertedLabel =
          converted != null && Number.isFinite(Number(converted))
            ? String(Number(converted))
            : "0";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help tabular-nums">{text}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <p>{cpaTip}</p>
              <p className="mt-1 text-muted-foreground">
                {t("digitalMarketing.metaAds.convertedLeadsCount", "Lead converted")}: {convertedLabel}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "service_converted_leads",
      label: t("digitalMarketing.metaAds.columnConvertedLeads", "Conv. leads"),
      headerTitle: cpaTip,
      cellClassName: "whitespace-nowrap text-right tabular-nums text-sm",
      render: (row) => {
        const r = row as Record<string, unknown>;
        const n = r.service_converted_leads;
        if (n == null || !Number.isFinite(Number(n))) return "—";
        return String(Number(n));
      },
    },
    {
      key: "name",
      label: t("digitalMarketing.metaAds.name", "Campaign"),
      cellClassName: "min-w-[10rem] max-w-[280px] font-medium",
      render: (row) => metaAdsRowDisplayName(row, "campaign"),
    },
  ];
}

type Props = {
  entity: MetaAdsMetricEntity;
  rows: MetaAdsMetricsRow[];
  metricItems: MetaAdsMetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  canEditServiceMapping?: boolean;
  adAccountId?: string | null;
  services?: ServiceOption[];
  onServiceMappingChange?: (row: MetaAdsMetricsRow, serviceId: string | null) => void;
  serviceMappingPending?: boolean;
};

export function MetaAdsMetricsTable({
  entity,
  rows,
  metricItems,
  currencyCode,
  isLoading,
  emptyMessage,
  canEditServiceMapping = false,
  services = [],
  onServiceMappingChange,
  serviceMappingPending = false,
}: Props) {
  const { t } = useTranslation();

  const identityCols: IdentityCol[] =
    entity === "campaign"
      ? campaignIdentityColumns(t, {
          canEditServiceMapping,
          services,
          onServiceMappingChange,
          serviceMappingPending,
          currencyCode,
        })
      : entity === "adset"
        ? [
            {
              key: "name",
              label: t("digitalMarketing.metaAds.name", "Name"),
              render: (row) => metaAdsRowDisplayName(row, entity),
            },
            {
              key: "campaign",
              label: t("digitalMarketing.metaAds.campaignColumn", "Campaign"),
              render: (row) => metaAdsRowSecondaryName(row, entity) ?? "—",
            },
          ]
        : [
            {
              key: "name",
              label: t("digitalMarketing.metaAds.name", "Name"),
              render: (row) => metaAdsRowDisplayName(row, entity),
            },
            {
              key: "adset",
              label: t("digitalMarketing.metaAds.adsetColumn", "Ad set"),
              render: (row) => metaAdsRowSecondaryName(row, entity) ?? "—",
            },
          ];

  const colSpan = identityCols.length + metricItems.length;
  const metricColClass = "min-w-[5.5rem] whitespace-nowrap px-3 text-right";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className={metaAdsMetricsTableScrollClass}>
          <table className="w-max min-w-full caption-bottom border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
              <tr className="border-b border-border hover:bg-transparent">
                {identityCols.map((h) => (
                  <th
                    key={h.key}
                    className={cn(
                      thBase,
                      h.cellClassName?.includes("text-right") ? "text-right" : undefined,
                      h.key === "name" && entity !== "campaign" ? "min-w-[10rem]" : undefined,
                      h.key === "campaign" || h.key === "adset" ? "min-w-[6.5rem]" : undefined,
                    )}
                    title={h.headerTitle}
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
                  return (
                    <tr
                      key={metaAdsRowReactKey(row, entity, i)}
                      className="border-b border-border transition-colors hover:bg-muted/50"
                    >
                      {identityCols.map((col) => (
                        <td
                          key={col.key}
                          className={cn("p-2 align-middle", col.cellClassName)}
                        >
                          {col.render(row)}
                        </td>
                      ))}
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
    </TooltipProvider>
  );
}
