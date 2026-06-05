import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { GoogleAdsAdPreviewCell } from "@/6-0-google-ads/components/GoogleAdsAdPreviewCell";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import {
  LEADS_TOTAL_KEY,
  LEADS_VISIT_RATE_KEY,
} from "@/google-ads/metrics/googleAdsSynckerjaLeadsMetrics";
import {
  TRAFFIC_TOTAL_VISIT_PAGE_KEY,
  TRAFFIC_VISIT_CLICK_RATE_KEY,
} from "@/google-ads/metrics/googleAdsSynckerjaTrafficMetrics";
import { leadsVisitRateCellStyle } from "@/google-ads/metrics/leadsVisitRateCellStyle";
import { trafficVisitClickRateCellStyle } from "@/google-ads/metrics/trafficVisitClickRateCellStyle";
import { formatKeywordMatchType } from "@/google-ads/metrics/formatKeywordMatchType";
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
import { GOOGLE_ADS_IDENTITY_COLUMNS } from "@/google-ads/metrics/googleAdsIdentityColumns";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsMetricsRow,
  MetricCatalogItem,
} from "@/google-ads/metrics/types";

type ServiceOption = { id: string; name: string };

type IdentityCol = {
  key: string;
  label: string;
  render: (row: GoogleAdsMetricsRow) => string;
  cellClassName?: string;
  customCell?: (row: GoogleAdsMetricsRow) => ReactNode;
  headerTitle?: string;
};

export type GoogleAdsTableDisplayColumn =
  | { kind: "metric"; metric: MetricCatalogItem }
  | { kind: "optional_identity"; col: IdentityCol };

type Props = {
  entity: GoogleAdsMetricEntity;
  rows: GoogleAdsMetricsRow[];
  /** Ordered metrics + optional identity keys (status, type). */
  selectedColumnKeys: string[];
  metricItems: MetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  onCampaignDrillDown?: (row: GoogleAdsMetricsRow) => void;
  emptyMessage?: string;
  /** Campaign entity: inline service mapping */
  canEditServiceMapping?: boolean;
  customerId?: string | null;
  organizationId?: string | null;
  services?: ServiceOption[];
  onServiceMappingChange?: (
    row: GoogleAdsMetricsRow,
    serviceId: string | null,
  ) => void | Promise<void>;
  serviceMappingPending?: boolean;
};

function formatServiceCpa(
  value: unknown,
  currencyCode: string | null | undefined,
): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return formatMetricValue("spent", Number(value), currencyCode ?? "IDR", "micros");
}

function campaignIdentityColumns(
  t: (key: string, defaultValue?: string) => string,
  opts: {
    canEditServiceMapping: boolean;
    services: ServiceOption[];
    onServiceMappingChange?: Props["onServiceMappingChange"];
    serviceMappingPending: boolean;
    currencyCode: string | null;
  },
): IdentityCol[] {
  const serviceAggregateTip = t(
    "digitalMarketing.googleAds.serviceAggregateTip",
    "CPA per campaign: spent campaign ini dibagi lead Converted yang UTM campaign-nya cocok dengan nama campaign Google (wajib gclid, converted_at dalam rentang tanggal). CPL untuk lead yang belum converted.",
  );

  return [
    {
      key: "service",
      label: t("digitalMarketing.googleAds.columnService", "Service"),
      render: (r) => String(r.identity.service_name ?? "—"),
      cellClassName: "min-w-[9rem] max-w-[200px]",
      customCell: opts.canEditServiceMapping
        ? (row) => {
            const currentId = String(row.identity.service_id ?? "").trim();
            const displayName = String(row.identity.service_name ?? "").trim();
            return (
              <Select
                value={currentId || "__none__"}
                disabled={opts.serviceMappingPending}
                onValueChange={(value) => {
                  const next = value === "__none__" ? null : value;
                  void opts.onServiceMappingChange?.(row, next);
                }}
              >
                <SelectTrigger className="h-8 w-full max-w-[200px] text-xs">
                  <SelectValue placeholder={t("digitalMarketing.googleAds.selectService", "Pilih service")}>
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
          }
        : undefined,
    },
    {
      key: "service_cpl",
      label: t("digitalMarketing.googleAds.columnCostPerLead", "CPA"),
      headerTitle: serviceAggregateTip,
      render: (r) => formatServiceCpa(r.identity.service_cpl, opts.currencyCode),
      cellClassName: "whitespace-nowrap text-right tabular-nums text-sm",
      customCell: (row) => {
        const text = formatServiceCpa(row.identity.service_cpl, opts.currencyCode);
        const converted = row.identity.service_converted_leads;
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
              <p>{serviceAggregateTip}</p>
              <p className="mt-1 text-muted-foreground">
                {t("digitalMarketing.googleAds.convertedLeadsCount", "Lead converted")}: {convertedLabel}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "service_converted_leads",
      label: t("digitalMarketing.googleAds.columnConvertedLeads", "Conv. leads"),
      headerTitle: serviceAggregateTip,
      render: (r) => {
        const n = r.identity.service_converted_leads;
        if (n == null || !Number.isFinite(Number(n))) return "—";
        return String(Number(n));
      },
      cellClassName: "whitespace-nowrap text-right tabular-nums text-sm",
    },
    { key: "name", label: "Campaign", render: (r) => String(r.identity.name ?? "—") },
  ];
}

function optionalIdentityColumns(
  entity: GoogleAdsMetricEntity,
  t: (key: string, defaultValue?: string) => string,
): IdentityCol[] {
  if (entity === "campaign") {
    return [
      {
        key: "status",
        label: "Status",
        render: (r) => String(r.identity.status ?? "—"),
        cellClassName: "whitespace-nowrap text-sm",
      },
      {
        key: "channel",
        label: "Type",
        render: (r) => String(r.identity.channel_type ?? "—"),
        cellClassName: "whitespace-nowrap text-sm",
      },
    ];
  }
  return [
    {
      key: "status",
      label: "Status",
      render: (r) => String(r.identity.status ?? "—"),
      cellClassName: "whitespace-nowrap text-sm",
    },
  ];
}

function lockedIdentityColumns(
  entity: GoogleAdsMetricEntity,
  t: (key: string, defaultValue?: string) => string,
  campaignOpts: Parameters<typeof campaignIdentityColumns>[1] | null,
): IdentityCol[] {
  const lockedKeys = new Set(GOOGLE_ADS_IDENTITY_COLUMNS[entity].map((c) => c.key));
  const allCols =
    entity === "campaign" && campaignOpts
      ? campaignIdentityColumns(t, {
          canEditServiceMapping: campaignOpts.canEditServiceMapping,
          services: campaignOpts.services,
          onServiceMappingChange: campaignOpts.onServiceMappingChange,
          serviceMappingPending: campaignOpts.serviceMappingPending,
          currencyCode: campaignOpts.currencyCode,
        })
      : entity === "ad_group"
        ? [
            { key: "name", label: "Ad group", render: (r) => String(r.identity.name ?? "—") },
            {
              key: "campaign",
              label: "Campaign",
              render: (r) => String(r.identity.campaign_name ?? "—"),
            },
          ]
        : entity === "keyword"
          ? [
              {
                key: "keyword",
                label: "Keyword",
                render: (r) => String(r.identity.keyword_text ?? "—"),
                cellClassName: "max-w-[240px] font-medium",
              },
              {
                key: "match_type",
                label: "Match type",
                render: (r) => formatKeywordMatchType(r.identity.match_type),
                cellClassName: "whitespace-nowrap text-sm",
              },
              {
                key: "campaign",
                label: "Campaign",
                render: (r) => String(r.identity.campaign_name ?? "—"),
                cellClassName: "max-w-[200px] truncate",
              },
              {
                key: "ad_group",
                label: "Ad group",
                render: (r) => String(r.identity.ad_group_name ?? "—"),
                cellClassName: "max-w-[200px] truncate",
              },
            ]
          : [
              {
                key: "preview",
                label: "Ad",
                render: () => "",
                cellClassName: "align-top p-3",
                customCell: (row: GoogleAdsMetricsRow) => <GoogleAdsAdPreviewCell row={row} />,
              },
            ];
  return allCols.filter((c) => lockedKeys.has(c.key));
}

/** Tipis & transparan — lihat `.seamless-scroll` di `index.css` (bukan scrollbar OS tebal). */
export const googleAdsMetricsTableScrollClass = cn(
  "nested-scroll-touch-chain seamless-scroll min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto",
);

const thBase =
  "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle text-sm font-medium text-muted-foreground";

export function GoogleAdsMetricsTable({
  entity,
  rows,
  selectedColumnKeys,
  metricItems,
  currencyCode,
  isLoading,
  onCampaignDrillDown,
  emptyMessage,
  canEditServiceMapping = false,
  customerId: _customerId,
  organizationId: _organizationId,
  services = [],
  onServiceMappingChange,
  serviceMappingPending = false,
}: Props) {
  const { t } = useTranslation();
  const campaignOpts =
    entity === "campaign"
      ? {
          canEditServiceMapping,
          services,
          onServiceMappingChange,
          serviceMappingPending,
          currencyCode,
        }
      : null;
  const lockedIdCols = lockedIdentityColumns(entity, t, campaignOpts);
  const optionalByKey = new Map(optionalIdentityColumns(entity, t).map((c) => [c.key, c]));
  const metricByKey = new Map(metricItems.map((m) => [m.key, m]));
  const displayColumns: GoogleAdsTableDisplayColumn[] = selectedColumnKeys
    .map((key) => {
      const metric = metricByKey.get(key);
      if (metric) return { kind: "metric" as const, metric };
      const col = optionalByKey.get(key);
      if (col) return { kind: "optional_identity" as const, col };
      return null;
    })
    .filter((c): c is GoogleAdsTableDisplayColumn => c != null);
  const metricColClass = "min-w-[5.5rem] whitespace-nowrap px-3 text-right";
  const colSpan = lockedIdCols.length + displayColumns.length;

  const renderIdentityHeader = (c: IdentityCol) => (
    <th
      key={c.key}
      title={c.headerTitle}
      className={cn(
        thBase,
        c.key === "service_cpl" || c.key === "service_converted_leads" ? "text-right" : "",
        c.key === "preview"
          ? "min-w-[min(480px,55vw)]"
          : c.key === "keyword" || c.key === "name"
            ? "min-w-[10rem]"
            : c.key === "service"
              ? "min-w-[9rem]"
              : c.key === "status" || c.key === "channel"
                ? "min-w-[5.5rem]"
                : "min-w-[6.5rem]",
      )}
    >
      {c.label}
    </th>
  );

  const renderMetricCell = (metric: MetricCatalogItem, row: GoogleAdsMetricsRow) => {
    const raw = row.metrics[metric.key];
    const formatted = formatMetricValue(
      metric.key,
      raw,
      currencyCode,
      metric.valueKind,
    );
    const rateStyle =
      metric.key === TRAFFIC_VISIT_CLICK_RATE_KEY
        ? trafficVisitClickRateCellStyle(raw)
        : metric.key === LEADS_VISIT_RATE_KEY
          ? leadsVisitRateCellStyle(raw)
          : undefined;
    const nullVisitTooltip =
      metric.key === TRAFFIC_TOTAL_VISIT_PAGE_KEY && (raw == null || !Number.isFinite(raw))
        ? t(
            "digitalMarketing.googleAds.trafficVisitUnavailable",
            "Data traffic belum tersedia. Sync data di halaman Traffic untuk rentang ini.",
          )
        : null;
    const zeroLeadsTooltip =
      metric.key === LEADS_TOTAL_KEY && raw === 0
        ? t(
            "digitalMarketing.googleAds.leadsTotalZero",
            "Tidak ada lead dengan utm_campaign yang exact-match nama campaign ini dalam rentang tanggal.",
          )
        : null;
    const activeTooltip = nullVisitTooltip ?? zeroLeadsTooltip;

    const inner = activeTooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block w-full cursor-help">{formatted}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {activeTooltip}
        </TooltipContent>
      </Tooltip>
    ) : (
      formatted
    );

    return (
      <td
        key={metric.key}
        className={cn("p-2 align-middle tabular-nums", metricColClass)}
        style={rateStyle}
      >
        {inner}
      </td>
    );
  };

  const renderIdentityCell = (c: IdentityCol, row: GoogleAdsMetricsRow) => {
    const text = c.render(row);
    const isCampaignName =
      entity === "campaign" && c.key === "name" && onCampaignDrillDown && row.id;
    const alignRight = c.key === "service_cpl" || c.key === "service_converted_leads";

    if (c.customCell) {
      return (
        <td
          key={c.key}
          className={cn("p-2 align-middle", alignRight && "text-right", c.cellClassName)}
        >
          {c.customCell(row)}
        </td>
      );
    }

    return (
      <td
        key={c.key}
        className={cn(
          "p-2 align-middle",
          c.cellClassName ?? "max-w-[280px] truncate",
          alignRight && "text-right",
        )}
        title={isCampaignName ? text : undefined}
      >
        {isCampaignName ? (
          <button
            type="button"
            className="block max-w-full truncate text-left font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => onCampaignDrillDown(row)}
          >
            {text}
          </button>
        ) : (
          text
        )}
      </td>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className={googleAdsMetricsTableScrollClass}>
          <table className="w-max min-w-full caption-bottom border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
              <tr className="border-b border-border hover:bg-transparent">
                {lockedIdCols.map(renderIdentityHeader)}
                {displayColumns.map((column) =>
                  column.kind === "metric" ? (
                    <th
                      key={column.metric.key}
                      className={cn(thBase, metricColClass, "text-right")}
                    >
                      {column.metric.label}
                    </th>
                  ) : (
                    renderIdentityHeader(column.col)
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading metrics…
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="py-16 text-center text-sm text-muted-foreground">
                    {emptyMessage ?? "No rows match your filters for this date range."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id || JSON.stringify(row.identity)}
                    className="border-b border-border transition-colors hover:bg-muted/50"
                  >
                    {lockedIdCols.map((c) => renderIdentityCell(c, row))}
                    {displayColumns.map((column) =>
                      column.kind === "metric"
                        ? renderMetricCell(column.metric, row)
                        : renderIdentityCell(column.col, row),
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
