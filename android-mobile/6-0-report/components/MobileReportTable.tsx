import { Link } from "react-router-dom";
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
import { GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/google-ads/settings/googleAdsSettingsPaths";
import { META_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/meta-ads/settings/metaAdsSettingsPaths";
import { TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/tiktok-ads/settings/tiktokAdsSettingsPaths";
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

function formatChannelCpc(cost: ReportChannelCost): string {
  return formatGoogleCpc(
    cost.amount,
    cost.clicks ?? 0,
    cost.currency ?? DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY,
    cost.connected,
  );
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
  const { t } = useAppTranslation();
  const connected = channelCost.connected && !channelCost.error;
  const cur = currency ?? channelCost.currency ?? DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY;

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className={cn(tdClass, "font-medium text-foreground")}>{channelLabel}</td>
      <td className={tdClass}>
        <ReportServiceCell serviceId={serviceId} serviceName={serviceName} />
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")} title={cpaTitle}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-14" />
        ) : (
          formatCostPerLead(costPerLead, cur)
        )}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {channelCost.loading ? <Skeleton className="ml-auto h-4 w-10" /> : formatCount(convertedLeads)}
      </td>
      <td className={tdClass}>
        {channelCost.loading ? (
          <Skeleton className="h-3.5 w-14" />
        ) : channelCost.error ? (
          <span className="text-[10px] text-destructive">{channelCost.error}</span>
        ) : (
          <span className="text-[10px] text-emerald-700">
            {t("digitalMarketing.report.statusConnected", "Connected")}
          </span>
        )}
      </td>
      <td className={cn(tdClass, "max-w-[8rem] truncate text-muted-foreground")}>
        {channelCost.accountLabel ?? "—"}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-16" />
        ) : (
          formatReportCost(amount, cur)
        )}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {channelCost.loading ? <Skeleton className="ml-auto h-4 w-12" /> : formatCount(impressions)}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-10" />
        ) : (
          formatChannelCtr(clicks, impressions, connected)
        )}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {channelCost.loading ? <Skeleton className="ml-auto h-4 w-12" /> : formatCount(clicks)}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {channelCost.loading ? (
          <Skeleton className="ml-auto h-4 w-12" />
        ) : (
          formatGoogleCpc(amount, clicks, cur, connected)
        )}
      </td>
    </tr>
  );
}

type ChannelLegacyRowProps = {
  channelLabel: string;
  cost: ReportChannelCost;
  channel: "google" | "meta" | "tiktok";
  notConnectedKey: string;
  settingsPath: string;
  settingsLinkKey: string;
};

function ChannelLegacyRow({
  channelLabel,
  cost,
  channel,
  notConnectedKey,
  settingsPath,
  settingsLinkKey,
}: ChannelLegacyRowProps) {
  const { t } = useAppTranslation();

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className={cn(tdClass, "font-medium text-foreground")}>{channelLabel}</td>
      <td className={cn(tdClass, "text-muted-foreground")}>—</td>
      <td className={cn(tdClass, "text-right text-muted-foreground")}>—</td>
      <td className={cn(tdClass, "text-right text-muted-foreground")}>—</td>
      <td className={tdClass}>
        {cost.loading ? (
          <Skeleton className="h-3.5 w-14" />
        ) : !cost.connected ? (
          <span className="text-[10px] text-muted-foreground">
            {t(notConnectedKey, "This channel is not connected.")}{" "}
            <Link to={settingsPath} className="font-medium text-primary underline">
              {t(settingsLinkKey, "Open settings")}
            </Link>
          </span>
        ) : (
          <span className="text-[10px] text-emerald-700">
            {t("digitalMarketing.report.statusConnected", "Connected")}
          </span>
        )}
      </td>
      <td className={cn(tdClass, "max-w-[8rem] truncate text-muted-foreground")}>
        {cost.accountLabel ?? "—"}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {cost.loading ? (
          <Skeleton className="ml-auto h-4 w-16" />
        ) : cost.error ? (
          <span className="text-destructive">{cost.error}</span>
        ) : (
          formatReportCost(cost.connected ? cost.amount : 0, cost.currency)
        )}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {cost.loading || cost.error
          ? cost.loading
            ? <Skeleton className="ml-auto h-4 w-12" />
            : "—"
          : formatCount(cost.connected ? cost.impressions : 0)}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {cost.loading || cost.error
          ? cost.loading
            ? <Skeleton className="ml-auto h-4 w-10" />
            : "—"
          : formatChannelCtr(
              cost.connected ? (cost.clicks ?? 0) : 0,
              cost.connected ? (cost.impressions ?? 0) : 0,
              cost.connected,
            )}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {cost.loading || cost.error
          ? cost.loading
            ? <Skeleton className="ml-auto h-4 w-12" />
            : "—"
          : formatCount(cost.connected ? cost.clicks : 0)}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>
        {cost.loading || cost.error
          ? cost.loading
            ? <Skeleton className="ml-auto h-4 w-12" />
            : "—"
          : channel === "google"
            ? formatGoogleCpc(cost.amount, cost.clicks ?? 0, cost.currency, cost.connected)
            : formatChannelCpc(cost)}
      </td>
    </tr>
  );
}

function ServiceRowSkeleton() {
  return (
    <tr className="border-b border-border/60">
      {Array.from({ length: 11 }, (_, i) => (
        <td key={i} className={tdClass}>
          <Skeleton className={cn("h-3.5", i >= 2 && i !== 4 && i !== 5 ? "ml-auto w-12" : "w-16")} />
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
    "CPA per service (Meta).",
  );
  const tiktokCpaTooltip = t(
    "digitalMarketing.report.tiktokServiceCplTooltip",
    "CPA per service (TikTok).",
  );
  const googleChannelLabel = t("digitalMarketing.report.channelGoogle", "Google Ads");
  const metaChannelLabel = t("digitalMarketing.report.channelMeta", "Meta Ads");
  const tiktokChannelLabel = t("digitalMarketing.report.channelTikTok", "TikTok Ads");

  const showGoogleLegacyRow = !googleCost.connected;
  const showMetaLegacyRow = !metaCost.connected;
  const showTikTokLegacyRow = !tiktokCost.connected;
  const showServiceRowSkeletons =
    !bootstrapLoading &&
    (googleServicesLoading || metaServicesLoading || tiktokServicesLoading);

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
        <table className="w-max min-w-[920px] caption-bottom border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thClass}>{t("digitalMarketing.report.tableChannel", "Channel")}</th>
              <th className={thClass}>{t("digitalMarketing.report.tableService", "Service")}</th>
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
              <ChannelLegacyRow
                channelLabel={googleChannelLabel}
                cost={googleCost}
                channel="google"
                notConnectedKey="digitalMarketing.report.googleNotConnected"
                settingsPath={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                settingsLinkKey="digitalMarketing.report.googleSettingsLink"
              />
            ) : showServiceRowSkeletons && googleServicesLoading ? (
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
            )}

            {showMetaLegacyRow ? (
              <ChannelLegacyRow
                channelLabel={metaChannelLabel}
                cost={metaCost}
                channel="meta"
                notConnectedKey="digitalMarketing.report.metaNotConnected"
                settingsPath={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                settingsLinkKey="digitalMarketing.report.metaSettingsLink"
              />
            ) : showServiceRowSkeletons && metaServicesLoading ? (
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
            )}

            {showTikTokLegacyRow ? (
              <ChannelLegacyRow
                channelLabel={tiktokChannelLabel}
                cost={tiktokCost}
                channel="tiktok"
                notConnectedKey="digitalMarketing.report.tiktokNotConnected"
                settingsPath={TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                settingsLinkKey="digitalMarketing.report.tiktokSettingsLink"
              />
            ) : showServiceRowSkeletons && tiktokServicesLoading ? (
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
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
