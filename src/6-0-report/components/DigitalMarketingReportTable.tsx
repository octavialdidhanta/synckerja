import { Link } from "react-router-dom";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import {
  computeSummaryCpc,
  computeSummaryCtr,
  formatMetaCtr,
  formatMetaMetricValue,
} from "@/meta-ads/metrics/formatMetaMetricValue";
import type { ReportChannelCost } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/google-ads/settings/googleAdsSettingsPaths";
import { META_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/meta-ads/settings/metaAdsSettingsPaths";

const thClass =
  "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle text-sm font-medium text-muted-foreground";

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatChannelCtr(cost: ReportChannelCost): string {
  if (!cost.connected) return "—";
  return formatMetaCtr(
    computeSummaryCtr(cost.clicks ?? 0, cost.impressions ?? 0),
    "computed",
  );
}

function formatChannelCpc(cost: ReportChannelCost, channel: "google" | "meta"): string {
  if (!cost.connected || cost.amount == null) return "—";
  const cpc = computeSummaryCpc(cost.amount, cost.clicks ?? 0);
  if (cpc == null) return "—";
  if (channel === "google") {
    return formatMetricValue("avg_cpc", cpc, cost.currency, "micros");
  }
  return formatMetaMetricValue("cpc", cpc, cost.currency);
}

function formatGoogleCost(cost: ReportChannelCost): string {
  if (cost.amount == null) return "—";
  return formatMetricValue("spent", cost.amount, cost.currency, "micros");
}

function formatMetaCost(cost: ReportChannelCost): string {
  if (cost.amount == null) return "—";
  return formatMetaMetricValue("spend", cost.amount, cost.currency);
}

type ChannelRowProps = {
  channelLabel: string;
  cost: ReportChannelCost;
  channel: "google" | "meta";
  notConnectedKey: string;
  settingsPath: string;
  settingsLinkKey: string;
};

function ChannelTableRow({
  channelLabel,
  cost,
  channel,
  notConnectedKey,
  settingsPath,
  settingsLinkKey,
}: ChannelRowProps) {
  const { t } = useAppTranslation();

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
      <td className="px-3 py-3 align-middle text-sm font-medium text-gray-900">
        {channelLabel}
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
          formatGoogleCost(cost)
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
          formatChannelCtr(cost)
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
        ) : (
          formatChannelCpc(cost, channel)
        )}
      </td>
    </tr>
  );
}

type Props = {
  googleCost: ReportChannelCost;
  metaCost: ReportChannelCost;
};

export function DigitalMarketingReportTable({
  googleCost,
  metaCost,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] caption-bottom border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={thClass}>{t("digitalMarketing.report.tableChannel", "Channel")}</th>
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
            <ChannelTableRow
              channelLabel={t("digitalMarketing.report.channelGoogle", "Google Ads")}
              cost={googleCost}
              channel="google"
              notConnectedKey="digitalMarketing.report.googleNotConnected"
              settingsPath={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
              settingsLinkKey="digitalMarketing.report.googleSettingsLink"
            />
            <ChannelTableRow
              channelLabel={t("digitalMarketing.report.channelMeta", "Meta Ads")}
              cost={metaCost}
              channel="meta"
              notConnectedKey="digitalMarketing.report.metaNotConnected"
              settingsPath={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
              settingsLinkKey="digitalMarketing.report.metaSettingsLink"
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
