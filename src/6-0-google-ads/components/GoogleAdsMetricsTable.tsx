import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { GoogleAdsAdPreviewCell } from "@/6-0-google-ads/components/GoogleAdsAdPreviewCell";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import { formatKeywordMatchType } from "@/google-ads/metrics/formatKeywordMatchType";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsMetricsRow,
  MetricCatalogItem,
} from "@/google-ads/metrics/types";

type IdentityCol = {
  key: string;
  label: string;
  render: (row: GoogleAdsMetricsRow) => string;
  cellClassName?: string;
  customCell?: (row: GoogleAdsMetricsRow) => ReactNode;
};

type Props = {
  entity: GoogleAdsMetricEntity;
  rows: GoogleAdsMetricsRow[];
  metricItems: MetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  onCampaignDrillDown?: (row: GoogleAdsMetricsRow) => void;
  emptyMessage?: string;
};

function identityColumns(entity: GoogleAdsMetricEntity): IdentityCol[] {
  if (entity === "campaign") {
    return [
      { key: "name", label: "Campaign", render: (r) => String(r.identity.name ?? "—") },
      { key: "status", label: "Status", render: (r) => String(r.identity.status ?? "—") },
      { key: "channel", label: "Type", render: (r) => String(r.identity.channel_type ?? "—") },
    ];
  }
  if (entity === "ad_group") {
    return [
      { key: "name", label: "Ad group", render: (r) => String(r.identity.name ?? "—") },
      { key: "campaign", label: "Campaign", render: (r) => String(r.identity.campaign_name ?? "—") },
      { key: "status", label: "Status", render: (r) => String(r.identity.status ?? "—") },
    ];
  }
  if (entity === "keyword") {
    return [
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
      {
        key: "status",
        label: "Status",
        render: (r) => String(r.identity.status ?? "—"),
        cellClassName: "whitespace-nowrap text-sm",
      },
    ];
  }
  return [
    {
      key: "preview",
      label: "Ad",
      render: () => "",
      cellClassName: "align-top p-3",
      customCell: (row) => <GoogleAdsAdPreviewCell row={row} />,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => String(r.identity.status ?? "—"),
      cellClassName: "whitespace-nowrap text-sm",
    },
  ];
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
  metricItems,
  currencyCode,
  isLoading,
  onCampaignDrillDown,
  emptyMessage,
}: Props) {
  const idCols = identityColumns(entity);
  const metricColClass = "min-w-[5.5rem] whitespace-nowrap px-3 text-right";
  const colSpan = idCols.length + metricItems.length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className={googleAdsMetricsTableScrollClass}>
        <table className="w-max min-w-full caption-bottom border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <tr className="border-b border-border hover:bg-transparent">
              {idCols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    thBase,
                    c.key === "preview"
                      ? "min-w-[min(480px,55vw)]"
                      : c.key === "keyword" || c.key === "name"
                        ? "min-w-[10rem]"
                        : "min-w-[6.5rem]",
                  )}
                >
                  {c.label}
                </th>
              ))}
              {metricItems.map((m) => (
                <th key={m.key} className={cn(thBase, metricColClass, "text-right")}>
                  {m.label}
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
                  {idCols.map((c) => {
                    const text = c.render(row);
                    const isCampaignName =
                      entity === "campaign" && c.key === "name" && onCampaignDrillDown && row.id;

                    if (c.customCell) {
                      return (
                        <td key={c.key} className={cn("p-2 align-middle", c.cellClassName)}>
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
                  })}
                  {metricItems.map((m) => (
                    <td
                      key={m.key}
                      className={cn("p-2 align-middle", metricColClass, "tabular-nums")}
                    >
                      {formatMetricValue(m.key, row.metrics[m.key], currencyCode, m.valueKind)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
