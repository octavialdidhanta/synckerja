import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsMetricsRow,
  MetricCatalogItem,
} from "@/google-ads/metrics/types";

type Props = {
  entity: GoogleAdsMetricEntity;
  rows: GoogleAdsMetricsRow[];
  metricItems: MetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
};

function identityColumns(entity: GoogleAdsMetricEntity): { key: string; label: string; render: (row: GoogleAdsMetricsRow) => string }[] {
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
  return [
    {
      key: "preview",
      label: "Ad",
      render: (r) => String(r.identity.ad_preview ?? r.id ?? "—"),
    },
    { key: "ad_group", label: "Ad group", render: (r) => String(r.identity.ad_group_name ?? "—") },
    { key: "campaign", label: "Campaign", render: (r) => String(r.identity.campaign_name ?? "—") },
    { key: "type", label: "Ad type", render: (r) => String(r.identity.ad_type ?? "—") },
    { key: "status", label: "Status", render: (r) => String(r.identity.status ?? "—") },
  ];
}

export function GoogleAdsMetricsTable({
  entity,
  rows,
  metricItems,
  currencyCode,
  isLoading,
}: Props) {
  const idCols = identityColumns(entity);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading metrics…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        No rows match your filters for this date range.
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {idCols.map((c) => (
              <TableHead key={c.key} className="whitespace-nowrap">
                {c.label}
              </TableHead>
            ))}
            {metricItems.map((m) => (
              <TableHead key={m.key} className="whitespace-nowrap text-right">
                {m.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id || JSON.stringify(row.identity)}>
              {idCols.map((c) => (
                <TableCell
                  key={c.key}
                  className={
                    c.key === "preview"
                      ? "max-w-[280px] truncate"
                      : "max-w-[200px] truncate"
                  }
                  title={c.key === "preview" ? c.render(row) : undefined}
                >
                  {c.render(row)}
                </TableCell>
              ))}
              {metricItems.map((m) => (
                <TableCell key={m.key} className="whitespace-nowrap text-right tabular-nums">
                  {formatMetricValue(
                    m.key,
                    row.metrics[m.key],
                    currencyCode,
                    m.valueKind,
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
