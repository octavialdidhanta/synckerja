import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
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
  "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle text-sm font-medium text-muted-foreground";

function ReportServiceCell({
  serviceId,
  serviceName,
}: {
  serviceId: string | null;
  serviceName: string;
}) {
  const isUnmapped = serviceId == null;
  if (!isUnmapped) {
    return (
      <span className="block truncate font-medium text-gray-900">{serviceName}</span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        "bg-brand-red text-white",
      )}
    >
      <span className="truncate">{serviceName}</span>
    </span>
  );
}

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatChannelCtr(
  clicks: number,
  impressions: number,
  connected: boolean,
): string {
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

function formatReportCost(
  amount: number | null,
  currency: string | null,
): string {
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

type ReportServiceTableRowProps = {
  channelLabel: string;
  serviceId: string | null;
  serviceName: string;
  amount: number;
  impressions: number;
  clicks: number;
  convertedLeads: number | null;
  costPerLead: number | null;
  currency: string | null;
  channelCost: ReportChannelCost;
  cpaTooltip: string;
};

const metricCellClass =
  "px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900";

function ReportServiceTableRow({
  channelLabel,
  serviceId,
  serviceName,
  amount,
  impressions,
  clicks,
  convertedLeads,
  costPerLead,
  currency: rowCurrency,
  channelCost,
  cpaTooltip,
}: ReportServiceTableRowProps) {
  const connected = channelCost.connected && !channelCost.error;
  const currency =
    rowCurrency ?? channelCost.currency ?? DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY;

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
      <td className="px-3 py-3 align-middle text-sm font-medium text-gray-900">
        {channelLabel}
      </td>
      <td className="max-w-[12rem] px-3 py-3 align-middle text-sm text-muted-foreground">
        {channelCost.loading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <>
            <span className="block truncate" title={channelCost.accountLabel ?? undefined}>
              {channelCost.accountLabel ?? "—"}
            </span>
            {channelCost.error ? (
              <span className="mt-0.5 block text-xs text-destructive">{channelCost.error}</span>
            ) : null}
          </>
        )}
      </td>
      <td className="max-w-[12rem] px-3 py-3 align-middle text-sm">
        <ReportServiceCell serviceId={serviceId} serviceName={serviceName} />
      </td>
      <td className={metricCellClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-24" />
        ) : (
          formatReportCost(amount, currency)
        )}
      </td>
      <td className={metricCellClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatCount(impressions)
        )}
      </td>
      <td className={metricCellClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatCount(clicks)
        )}
      </td>
      <td className={metricCellClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-16" />
        ) : (
          formatChannelCtr(clicks, impressions, connected)
        )}
      </td>
      <td className={metricCellClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatGoogleCpc(amount, clicks, currency, connected)
        )}
      </td>
      <td className={metricCellClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-12" />
        ) : (
          formatCount(convertedLeads)
        )}
      </td>
      <td className={metricCellClass}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                {formatCostPerLead(costPerLead, currency)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {cpaTooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </td>
    </tr>
  );
}

const REPORT_TABLE_COLUMN_COUNT = 10;

/** Channel, Account, and Service stay left; metric columns are right-aligned. */
function reportTableSkeletonClass(columnIndex: number): string {
  const isRight = columnIndex >= 3;
  return cn("h-4", isRight ? "ml-auto h-5 w-16" : "w-20");
}

function ServiceRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: REPORT_TABLE_COLUMN_COUNT }, (_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className={reportTableSkeletonClass(i)} />
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

export function DigitalMarketingReportTable({
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
    "CPA per service: total mapped campaign spend divided by Converted leads (UTM campaign per campaign row, summed per service). CPL is for non-converted leads.",
  );
  const metaCpaTooltip = t(
    "digitalMarketing.report.metaServiceCplTooltip",
    "CPA (Meta): campaign spend divided by Purchases.",
  );
  const tiktokCpaTooltip = t(
    "digitalMarketing.report.tiktokServiceCplTooltip",
    "CPA per service (TikTok): total mapped campaign spend divided by Converted leads (UTM campaign per row, summed per service). CPL is for non-converted leads.",
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
        className="min-h-[12rem] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
        aria-hidden
      />
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="nested-scroll-touch-chain-xy seamless-scroll min-w-0 w-full overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[960px] caption-bottom border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={thClass}>{t("digitalMarketing.report.tableChannel", "Channel")}</th>
                <th className={thClass}>{t("digitalMarketing.report.tableAccount", "Account")}</th>
                <th className={thClass}>
                  {t("digitalMarketing.report.tableService", "Products or Services")}
                </th>
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
                    colSpan={REPORT_TABLE_COLUMN_COUNT}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
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
                    <ReportServiceTableRow
                      key={`google-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                      channelLabel={googleChannelLabel}
                      serviceId={row.serviceId}
                      serviceName={row.serviceName}
                      amount={row.amount}
                      impressions={row.impressions}
                      clicks={row.clicks}
                      convertedLeads={row.convertedLeads}
                      costPerLead={row.costPerLead}
                      currency={row.currency}
                      channelCost={googleCost}
                      cpaTooltip={cpaTooltip}
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
                    <ReportServiceTableRow
                      key={`meta-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                      channelLabel={metaChannelLabel}
                      serviceId={row.serviceId}
                      serviceName={row.serviceName}
                      amount={row.amount}
                      impressions={row.impressions}
                      clicks={row.clicks}
                      convertedLeads={row.convertedLeads}
                      costPerLead={row.costPerLead}
                      currency={row.currency}
                      channelCost={metaCost}
                      cpaTooltip={metaCpaTooltip}
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
                    <ReportServiceTableRow
                      key={`tiktok-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                      channelLabel={tiktokChannelLabel}
                      serviceId={row.serviceId}
                      serviceName={row.serviceName}
                      amount={row.amount}
                      impressions={row.impressions}
                      clicks={row.clicks}
                      convertedLeads={row.convertedLeads}
                      costPerLead={row.costPerLead}
                      currency={row.currency}
                      channelCost={tiktokCost}
                      cpaTooltip={tiktokCpaTooltip}
                    />
                  ))
                )
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
