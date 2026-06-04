import { Link } from "react-router-dom";
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
  formatMetaMetricValue,
} from "@/meta-ads/metrics/formatMetaMetricValue";
import type {
  ReportChannelCost,
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { useDigitalMarketingReportFilteredRows } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportFilteredRows";
import { GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/google-ads/settings/googleAdsSettingsPaths";
import { META_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/meta-ads/settings/metaAdsSettingsPaths";

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

function formatMetaCpc(cost: ReportChannelCost): string {
  if (!cost.connected || cost.amount == null) return "—";
  const cpc = computeSummaryCpc(cost.amount, cost.clicks ?? 0);
  if (cpc == null) return "—";
  return formatMetaMetricValue("cpc", cpc, cost.currency);
}

function formatGoogleCost(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  return formatMetricValue("spent", amount, currency, "micros");
}

function formatMetaCost(cost: ReportChannelCost): string {
  if (cost.amount == null) return "—";
  return formatMetaMetricValue("spend", cost.amount, cost.currency);
}

function formatCostPerLead(value: number | null | undefined, currency: string | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatMetricValue("spent", value, currency ?? "IDR", "micros");
}

type GoogleServiceTableRowProps = {
  channelLabel: string;
  row: ReportGoogleServiceRow;
  channelCost: ReportChannelCost;
  cpaTooltip: string;
};

type MetaServiceTableRowProps = {
  channelLabel: string;
  row: ReportMetaServiceRow;
  channelCost: ReportChannelCost;
  cpaTooltip: string;
};

function MetaServiceTableRow({
  channelLabel,
  row,
  channelCost,
  cpaTooltip,
}: MetaServiceTableRowProps) {
  const { t } = useAppTranslation();
  const connected = channelCost.connected && !channelCost.error;
  const currency = row.currency ?? channelCost.currency ?? "USD";

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
      <td className="px-3 py-3 align-middle text-sm font-medium text-gray-900">
        {channelLabel}
      </td>
      <td className="max-w-[12rem] px-3 py-3 align-middle text-sm">
        <ReportServiceCell serviceId={row.serviceId} serviceName={row.serviceName} />
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                {formatMetaMetricValue("spend", row.costPerLead, currency)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {cpaTooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-12" />
        ) : (
          formatCount(row.convertedLeads)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-sm">
        {channelCost.loading ? (
          <Skeleton className="h-4 w-16" />
        ) : channelCost.error ? (
          <span className="text-xs text-destructive">{channelCost.error}</span>
        ) : (
          <span className="text-xs text-emerald-700">
            {t("digitalMarketing.report.statusConnected", "Connected")}
          </span>
        )}
      </td>
      <td className="max-w-[12rem] truncate px-3 py-3 align-middle text-sm text-muted-foreground">
        {channelCost.accountLabel ?? "—"}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-24" />
        ) : (
          formatMetaMetricValue("spend", row.amount, currency)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatCount(row.impressions)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-16" />
        ) : (
          formatChannelCtr(row.clicks, row.impressions, connected)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatCount(row.clicks)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatMetaCpc({
            connected,
            amount: row.amount,
            clicks: row.clicks,
            currency,
          })
        )}
      </td>
    </tr>
  );
}

function GoogleServiceTableRow({
  channelLabel,
  row,
  channelCost,
  cpaTooltip,
}: GoogleServiceTableRowProps) {
  const { t } = useAppTranslation();
  const connected = channelCost.connected && !channelCost.error;
  const currency = row.currency ?? channelCost.currency ?? "IDR";

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
      <td className="px-3 py-3 align-middle text-sm font-medium text-gray-900">
        {channelLabel}
      </td>
      <td className="max-w-[12rem] px-3 py-3 align-middle text-sm">
        <ReportServiceCell serviceId={row.serviceId} serviceName={row.serviceName} />
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                {formatCostPerLead(row.costPerLead, currency)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {cpaTooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-12" />
        ) : (
          formatCount(row.convertedLeads)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-sm">
        {channelCost.loading ? (
          <Skeleton className="h-4 w-16" />
        ) : channelCost.error ? (
          <span className="text-xs text-destructive">{channelCost.error}</span>
        ) : (
          <span className="text-xs text-emerald-700">
            {t("digitalMarketing.report.statusConnected", "Connected")}
          </span>
        )}
      </td>
      <td className="max-w-[12rem] truncate px-3 py-3 align-middle text-sm text-muted-foreground">
        {channelCost.accountLabel ?? "—"}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-24" />
        ) : (
          formatGoogleCost(row.amount, currency)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatCount(row.impressions)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-16" />
        ) : (
          formatChannelCtr(row.clicks, row.impressions, connected)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatCount(row.clicks)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : (
          formatGoogleCpc(row.amount, row.clicks, currency, connected)
        )}
      </td>
    </tr>
  );
}

type ChannelTableRowProps = {
  channelLabel: string;
  serviceLabel: string;
  cost: ReportChannelCost;
  channel: "google" | "meta";
  notConnectedKey: string;
  settingsPath: string;
  settingsLinkKey: string;
};

function ChannelTableRow({
  channelLabel,
  serviceLabel,
  cost,
  channel,
  notConnectedKey,
  settingsPath,
  settingsLinkKey,
}: ChannelTableRowProps) {
  const { t } = useAppTranslation();

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
      <td className="px-3 py-3 align-middle text-sm font-medium text-gray-900">
        {channelLabel}
      </td>
      <td className="max-w-[12rem] truncate px-3 py-3 align-middle text-sm text-muted-foreground">
        {serviceLabel}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-muted-foreground">
        —
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-muted-foreground">
        —
      </td>
      <td className="px-3 py-3 align-middle text-sm">
        {cost.loading ? (
          <Skeleton className="h-4 w-16" />
        ) : !cost.connected ? (
          <span className="text-xs text-muted-foreground">
            {t(notConnectedKey)}{" "}
            <Link to={settingsPath} className="font-medium text-primary underline">
              {t(settingsLinkKey)}
            </Link>
          </span>
        ) : (
          <span className="text-xs text-emerald-700">
            {t("digitalMarketing.report.statusConnected", "Connected")}
          </span>
        )}
      </td>
      <td className="max-w-[12rem] truncate px-3 py-3 align-middle text-sm text-muted-foreground">
        {cost.accountLabel ?? "—"}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {cost.loading ? (
          <Skeleton className="ml-auto h-5 w-24" />
        ) : cost.error ? (
          <span className="text-destructive">{cost.error}</span>
        ) : !cost.connected ? (
          channel === "google"
            ? formatMetricValue("spent", 0, cost.currency ?? "IDR", "micros")
            : formatMetaMetricValue("spend", 0, cost.currency ?? "USD")
        ) : channel === "google" ? (
          formatGoogleCost(cost.amount, cost.currency)
        ) : (
          formatMetaCost(cost)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {cost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : cost.error ? (
          "—"
        ) : (
          formatCount(cost.connected ? cost.impressions : 0)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {cost.loading ? (
          <Skeleton className="ml-auto h-5 w-16" />
        ) : cost.error ? (
          "—"
        ) : (
          formatChannelCtr(
            cost.connected ? (cost.clicks ?? 0) : 0,
            cost.connected ? (cost.impressions ?? 0) : 0,
            cost.connected,
          )
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {cost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : cost.error ? (
          "—"
        ) : (
          formatCount(cost.connected ? cost.clicks : 0)
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
        {cost.loading ? (
          <Skeleton className="ml-auto h-5 w-20" />
        ) : cost.error ? (
          "—"
        ) : channel === "google" ? (
          formatGoogleCpc(cost.amount, cost.clicks ?? 0, cost.currency, cost.connected)
        ) : (
          formatMetaCpc(cost)
        )}
      </td>
    </tr>
  );
}

const REPORT_TABLE_COLUMN_COUNT = 11;

/** Status & Account are left-aligned; metric columns are right-aligned. */
function reportTableSkeletonClass(columnIndex: number): string {
  const isRight = columnIndex >= 2 && columnIndex !== 4 && columnIndex !== 5;
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
  googleCost: ReportChannelCost;
  metaCost: ReportChannelCost;
  googleServiceRows: ReportGoogleServiceRow[];
  googleServicesLoading?: boolean;
  metaServiceRows: ReportMetaServiceRow[];
  metaServicesLoading?: boolean;
};

export function DigitalMarketingReportTable({
  googleCost,
  metaCost,
  googleServiceRows,
  googleServicesLoading = false,
  metaServiceRows,
  metaServicesLoading = false,
}: Props) {
  const { t } = useAppTranslation();
  const { filteredGoogleRows, filteredMetaRows } = useDigitalMarketingReportFilteredRows(
    googleServiceRows,
    metaServiceRows,
  );
  const cpaTooltip = t(
    "digitalMarketing.report.serviceCplTooltip",
    "CPA per service: total mapped campaign spend divided by Converted leads (UTM campaign per campaign row, summed per service). CPL is for non-converted leads.",
  );
  const metaCpaTooltip = t(
    "digitalMarketing.report.metaServiceCplTooltip",
    "CPA per service (Meta): total mapped campaign spend divided by Converted leads with fbclid (UTM campaign per row, summed per service). CPL is for non-converted leads.",
  );
  const googleChannelLabel = t("digitalMarketing.report.channelGoogle", "Google Ads");
  const metaChannelLabel = t("digitalMarketing.report.channelMeta", "Meta Ads");
  const showGoogleServiceRows = googleCost.connected && !googleCost.error;
  const showGoogleLegacyRow = !googleCost.connected;
  const showMetaLegacyRow = !metaCost.connected;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] caption-bottom border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={thClass}>{t("digitalMarketing.report.tableChannel", "Channel")}</th>
                <th className={thClass}>
                  {t("digitalMarketing.report.tableService", "Service")}
                </th>
                <th className={cn(thClass, "text-right")}>
                  {t("digitalMarketing.report.tableCostPerLead", "CPA")}
                </th>
                <th className={cn(thClass, "text-right")}>
                  {t("digitalMarketing.report.tableConvertedLeads", "Conv. leads")}
                </th>
                <th className={thClass}>{t("digitalMarketing.report.tableStatus", "Status")}</th>
                <th className={thClass}>{t("digitalMarketing.report.tableAccount", "Account")}</th>
                <th className={cn(thClass, "text-right")}>
                  {t("digitalMarketing.report.tableCost", "Cost")}
                </th>
                <th className={cn(thClass, "text-right")}>
                  {t("digitalMarketing.report.tableImpressions", "Impressions")}
                </th>
                <th className={cn(thClass, "text-right")}>
                  {t("digitalMarketing.report.tableCtr", "CTR")}
                </th>
                <th className={cn(thClass, "text-right")}>
                  {t("digitalMarketing.report.tableClicks", "Clicks")}
                </th>
                <th className={cn(thClass, "text-right")}>
                  {t("digitalMarketing.report.tableCpc", "CPC")}
                </th>
              </tr>
            </thead>
            <tbody>
              {showGoogleLegacyRow ? (
                <ChannelTableRow
                  channelLabel={googleChannelLabel}
                  serviceLabel="—"
                  cost={googleCost}
                  channel="google"
                  notConnectedKey="digitalMarketing.report.googleNotConnected"
                  settingsPath={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                  settingsLinkKey="digitalMarketing.report.googleSettingsLink"
                />
              ) : googleServicesLoading ? (
                <>
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                </>
              ) : (
                filteredGoogleRows.map((row) => (
                  <GoogleServiceTableRow
                    key={`google-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                    channelLabel={googleChannelLabel}
                    row={row}
                    channelCost={googleCost}
                    cpaTooltip={cpaTooltip}
                  />
                ))
              )}

              {showMetaLegacyRow ? (
                <ChannelTableRow
                  channelLabel={metaChannelLabel}
                  serviceLabel="—"
                  cost={metaCost}
                  channel="meta"
                  notConnectedKey="digitalMarketing.report.metaNotConnected"
                  settingsPath={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                  settingsLinkKey="digitalMarketing.report.metaSettingsLink"
                />
              ) : metaServicesLoading ? (
                <>
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                </>
              ) : (
                filteredMetaRows.map((row) => (
                  <MetaServiceTableRow
                    key={`meta-${row.serviceId ?? `unmapped-${row.serviceName}`}`}
                    channelLabel={metaChannelLabel}
                    row={row}
                    channelCost={metaCost}
                    cpaTooltip={metaCpaTooltip}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
