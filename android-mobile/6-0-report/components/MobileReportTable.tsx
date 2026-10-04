import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import {
  computeSummaryCpc,
  computeSummaryCtr,
  formatMetaCtr,
} from "@/meta-ads/metrics/formatMetaMetricValue";
import type {
  ReportChannelCost,
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { useDigitalMarketingReportFilteredRows } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportFilteredRows";
import { DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY } from "@/6-0-digital-marketing-shared/reportDisplayCurrency";

const thClass =
  "h-9 whitespace-nowrap bg-muted/40 px-2.5 text-left align-middle text-[11px] font-medium text-muted-foreground";
const tdClass = "px-2.5 py-2.5 align-middle text-xs";

function ReportServiceCell({
  serviceId,
  serviceName,
}: {
  serviceId: string | null;
  serviceName: string;
}) {
  if (serviceId != null) {
    return <span className="block max-w-[9rem] truncate font-medium text-foreground">{serviceName}</span>;
  }
  return (
    <span className="inline-flex max-w-[9rem] items-center rounded-md bg-brand-red px-1.5 py-0.5 text-[10px] font-semibold text-white">
      <span className="truncate">{serviceName}</span>
    </span>
  );
}

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatChannelCtr(clicks: number, impressions: number, connected: boolean): string {
  if (!connected) return "—";
  return formatMetaCtr(computeSummaryCtr(clicks, impressions), "computed");
}

function formatGoogleCpc(
  amount: number | null,
  clicks: number,
  currency: string | null,
  connected: boolean,
): string {
  if (!connected || amount == null) return "—";
  const cpc = computeSummaryCpc(amount, clicks);
  if (cpc == null) return "—";
  return formatMetricValue("avg_cpc", cpc, currency, "micros");
}

function formatReportCost(amount: number | null, currency: string | null): string {
  return formatMetricValue(
    "spent",
    amount ?? 0,
    currency ?? DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY,
    "micros",
  );
}

function formatCostPerLead(value: number | null | undefined, currency: string | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatMetricValue("spent", value, currency ?? "IDR", "micros");
}

type ServiceRowProps = {
  channelLabel: string;
  serviceId: string | null;
  serviceName: string;
  costPerLead: number | null;
  convertedLeads: number | null;
  amount: number;
  impressions: number;
  clicks: number;
  currency: string | null;
  channelCost: ReportChannelCost;
  cpaTitle: string;
};

function ServiceMetricRow({
  channelLabel,
  serviceId,
  serviceName,
  costPerLead,
  convertedLeads,
  amount,
  impressions,
  clicks,
  currency,
  channelCost,
  cpaTitle,
}: ServiceRowProps) {
  const connected = channelCost.connected && !channelCost.error;
  const cur = currency ?? channelCost.currency ?? DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY;
  const metricClass = cn(tdClass, "text-right tabular-nums");

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className={cn(tdClass, "font-medium text-foreground")}>{channelLabel}</td>
      <td className={cn(tdClass, "max-w-[8rem] text-muted-foreground")}>
        {channelCost.loading ? (
          <Skeleton className="h-3.5 w-16" />
        ) : (
          <>
            <span className="block truncate">{channelCost.accountLabel ?? "—"}</span>
            {channelCost.error ? (
              <span className="mt-0.5 block text-[10px] text-destructive">{channelCost.error}</span>
            ) : null}
          </>
        )}
      </td>
      <td className={tdClass}>
        <ReportServiceCell serviceId={serviceId} serviceName={serviceName} />
      </td>
      <td className={metricClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-16" />
        ) : (
          formatReportCost(amount, cur)
        )}
      </td>
      <td className={metricClass}>
        {channelCost.loading ? <Skeleton className="ml-auto h-4 w-12" /> : formatCount(impressions)}
      </td>
      <td className={metricClass}>
        {channelCost.loading ? <Skeleton className="ml-auto h-4 w-12" /> : formatCount(clicks)}
      </td>
      <td className={metricClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-10" />
        ) : (
          formatChannelCtr(clicks, impressions, connected)
        )}
      </td>
      <td className={metricClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-12" />
        ) : (
          formatGoogleCpc(amount, clicks, cur, connected)
        )}
      </td>
      <td className={metricClass}>
        {channelCost.loading ? <Skeleton className="ml-auto h-4 w-10" /> : formatCount(convertedLeads)}
      </td>
      <td className={metricClass} title={cpaTitle}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-14" />
        ) : (
          formatCostPerLead(costPerLead, cur)
        )}
      </td>
    </tr>
  );
}

function ServiceRowSkeleton() {
  return (
    <tr className="border-b border-border/60">
      {Array.from({ length: 10 }, (_, i) => (
        <td key={i} className={tdClass}>
          <Skeleton className={cn("h-3.5", i >= 3 ? "ml-auto w-12" : "w-16")} />
        </td>
      ))}
    </tr>
  );
}

type Props = {
  bootstrapLoading?: boolean;
  googleCost: ReportChannelCost;
  metaCost: ReportChannelCost;
  tiktokCost: ReportChannelCost;
  googleServiceRows: ReportGoogleServiceRow[];
  googleServicesLoading?: boolean;
  metaServiceRows: ReportMetaServiceRow[];
  metaServicesLoading?: boolean;
  tiktokServiceRows: ReportTikTokServiceRow[];
  tiktokServicesLoading?: boolean;
};

/**
 * Horizontal-scroll metrics table for mobile Report (mirrors desktop columns / formatters).
 */
export function MobileReportTable({
  bootstrapLoading = false,
  googleCost,
  metaCost,
  tiktokCost,
  googleServiceRows,
  googleServicesLoading = false,
  metaServiceRows,
  metaServicesLoading = false,
  tiktokServiceRows,
  tiktokServicesLoading = false,
}: Props) {
  const { t } = useAppTranslation();
  const { filteredGoogleRows, filteredMetaRows, filteredTikTokRows } =
    useDigitalMarketingReportFilteredRows(googleServiceRows, metaServiceRows, tiktokServiceRows);

  const cpaTooltip = t(
    "digitalMarketing.report.serviceCplTooltip",
    "CPA per service: total mapped campaign spend divided by Converted leads.",
  );
  const metaCpaTooltip = t(
    "digitalMarketing.report.metaServiceCplTooltip",
    "CPA (Meta): campaign spend divided by Purchases.",
  );
  const tiktokCpaTooltip = t(
    "digitalMarketing.report.tiktokServiceCplTooltip",
    "CPA per service (TikTok).",
  );
  const googleChannelLabel = t("digitalMarketing.report.channelGoogle", "Google Ads");
  const metaChannelLabel = t("digitalMarketing.report.channelMeta", "Meta Ads");
  const tiktokChannelLabel = t("digitalMarketing.report.channelTikTok", "TikTok Ads");

  const showGoogleChannel = googleCost.connected;
  const showMetaChannel = metaCost.connected;
  const showTikTokChannel = tiktokCost.connected;
  const showServiceRowSkeletons =
    !bootstrapLoading &&
    (googleServicesLoading || metaServicesLoading || tiktokServicesLoading);
  const showNoConnectedAccounts =
    !showGoogleChannel &&
    !showMetaChannel &&
    !showTikTokChannel &&
    !googleCost.loading &&
    !metaCost.loading &&
    !tiktokCost.loading;

  if (bootstrapLoading && (googleServicesLoading || metaServicesLoading || tiktokServicesLoading)) {
    return (
      <div
        className="-mx-2 min-h-[10rem] overflow-hidden border-y border-border bg-card"
        aria-hidden
      />
    );
  }

  return (
    <div className="-mx-2 min-w-0 border-y border-border bg-card">
      <div
        className={cn(
          "nested-scroll-touch-chain-xy scrollbar-hide min-w-0 w-full overflow-x-auto overflow-y-hidden",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <table className="w-full min-w-[960px] caption-bottom border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thClass}>{t("digitalMarketing.report.tableChannel", "Channel")}</th>
              <th className={thClass}>{t("digitalMarketing.report.tableAccount", "Account")}</th>
              <th className={thClass}>{t("digitalMarketing.report.tableService", "Products or Services")}</th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.report.tableCost", "Cost")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.report.tableImpressions", "Impressions")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.report.tableClicks", "Clicks")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.report.tableCtr", "CTR")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.report.tableCpc", "CPC")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.report.tableConv", "Conv.")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.report.tableCostPerLead", "CPA")}
              </th>
            </tr>
          </thead>
          <tbody>
            {showNoConnectedAccounts ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-2.5 py-8 text-center text-xs text-muted-foreground"
                >
                  {t(
                    "digitalMarketing.report.noConnectedAccounts",
                    "No connected ad accounts yet.",
                  )}
                </td>
              </tr>
            ) : null}

            {showGoogleChannel ? (
              showServiceRowSkeletons && googleServicesLoading ? (
                <>
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                </>
              ) : (
                filteredGoogleRows.map((row) => (
                  <ServiceMetricRow
                    key={`google-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                    channelLabel={googleChannelLabel}
                    serviceId={row.serviceId}
                    serviceName={row.serviceName}
                    costPerLead={row.costPerLead}
                    convertedLeads={row.convertedLeads}
                    amount={row.amount}
                    impressions={row.impressions}
                    clicks={row.clicks}
                    currency={row.currency}
                    channelCost={googleCost}
                    cpaTitle={cpaTooltip}
                  />
                ))
              )
            ) : null}

            {showMetaChannel ? (
              showServiceRowSkeletons && metaServicesLoading ? (
                <>
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                </>
              ) : (
                filteredMetaRows.map((row) => (
                  <ServiceMetricRow
                    key={`meta-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                    channelLabel={metaChannelLabel}
                    serviceId={row.serviceId}
                    serviceName={row.serviceName}
                    costPerLead={row.costPerLead}
                    convertedLeads={row.convertedLeads}
                    amount={row.amount}
                    impressions={row.impressions}
                    clicks={row.clicks}
                    currency={row.currency}
                    channelCost={metaCost}
                    cpaTitle={metaCpaTooltip}
                  />
                ))
              )
            ) : null}

            {showTikTokChannel ? (
              showServiceRowSkeletons && tiktokServicesLoading ? (
                <>
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                </>
              ) : (
                filteredTikTokRows.map((row) => (
                  <ServiceMetricRow
                    key={`tiktok-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                    channelLabel={tiktokChannelLabel}
                    serviceId={row.serviceId}
                    serviceName={row.serviceName}
                    costPerLead={row.costPerLead}
                    convertedLeads={row.convertedLeads}
                    amount={row.amount}
                    impressions={row.impressions}
                    clicks={row.clicks}
                    currency={row.currency}
                    channelCost={tiktokCost}
                    cpaTitle={tiktokCpaTooltip}
                  />
                ))
              )
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
