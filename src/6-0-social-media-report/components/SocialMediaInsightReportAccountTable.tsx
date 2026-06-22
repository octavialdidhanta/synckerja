import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import { ThreadsTabIcon } from "@/6-0-social-media-performance/components/ThreadsTabIcon";
import { SocialMediaInsightAccountAvatar } from "@/6-0-social-media-report/components/SocialMediaInsightAccountAvatar";
import type { SocialMediaInsightAccountRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

type Props = {
  rows: SocialMediaInsightAccountRow[];
  organizationId?: string | null;
  isLoading?: boolean;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatPercent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function PlatformIcon({ platform }: { platform: SocialMediaInsightAccountRow["platform"] }) {
  switch (platform) {
    case "tiktok":
      return <TikTokTabIcon className="h-4 w-4 shrink-0" />;
    case "youtube":
      return <Youtube className="h-4 w-4 shrink-0" />;
    case "instagram":
      return <Instagram className="h-4 w-4 shrink-0" />;
    case "facebook":
      return <Facebook className="h-4 w-4 shrink-0" />;
    case "linkedin":
      return <Linkedin className="h-4 w-4 shrink-0" />;
    case "threads":
      return <ThreadsTabIcon className="h-4 w-4 shrink-0" />;
  }
}

function platformLabel(
  platform: SocialMediaInsightAccountRow["platform"],
  t: ReturnType<typeof useAppTranslation>["t"],
): string {
  switch (platform) {
    case "tiktok":
      return t("digitalMarketing.socialMediaPerformance.platformTikTok", "TikTok");
    case "youtube":
      return t("digitalMarketing.socialMediaPerformance.platformYouTube", "YouTube");
    case "linkedin":
      return t("digitalMarketing.socialMediaPerformance.platformLinkedIn", "LinkedIn");
    case "instagram":
      return t("digitalMarketing.socialMediaPerformance.platformInstagram", "Instagram");
    case "facebook":
      return t("digitalMarketing.socialMediaPerformance.platformFacebook", "Facebook");
    case "threads":
      return t("digitalMarketing.socialMediaPerformance.platformThreads", "Threads");
  }
}

function audienceCell(
  row: SocialMediaInsightAccountRow,
  t: ReturnType<typeof useAppTranslation>["t"],
): string {
  if (!row.connected || row.isPlatformPlaceholder) return "—";
  if (row.audienceHidden) {
    return t("digitalMarketing.youtubeContent.subscriberCountHidden", "Hidden");
  }
  if (row.audienceCount == null) return "—";
  const suffix =
    row.audienceLabel === "followers"
      ? t("digitalMarketing.socialMediaInsightReport.followersShort", "followers")
      : row.audienceLabel === "subscribers"
        ? t("digitalMarketing.socialMediaInsightReport.subscribersShort", "subscribers")
        : "";
  return suffix ? `${formatCount(row.audienceCount)} ${suffix}` : formatCount(row.audienceCount);
}

const thClass =
  "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle text-sm font-medium text-muted-foreground";

export function SocialMediaInsightReportAccountTable({ rows, organizationId, isLoading = false }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] caption-bottom border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={thClass}>{t("digitalMarketing.socialMediaInsightReport.colPlatform", "Platform")}</th>
              <th className={thClass}>{t("digitalMarketing.socialMediaInsightReport.colAccount", "Account")}</th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colAudience", "Audience")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colContent", "Content")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colViews", "Views")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colLikes", "Likes")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colComments", "Comments")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colShares", "Shares")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colEngagement", "Engagement")}
              </th>
              <th className={cn(thClass, "text-right")}>
                {t("digitalMarketing.socialMediaInsightReport.colPlanMatched", "Plan matched")}
              </th>
              <th className={thClass}>{t("digitalMarketing.socialMediaInsightReport.colStatus", "Status")}</th>
              <th className={thClass}>{t("digitalMarketing.socialMediaInsightReport.colAction", "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 12 }, (_, j) => (
                      <td key={j} className="px-3 py-3 align-middle">
                        <Skeleton className={cn("h-4", j >= 2 && j <= 9 ? "ml-auto h-5 w-14" : "w-20")} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const key = row.isPlatformPlaceholder
                    ? `placeholder-${row.platform}`
                    : `${row.platform}-${row.accountId}`;
                  const label = row.isPlatformPlaceholder
                    ? platformLabel(row.platform, t)
                    : row.accountLabel || row.accountId;

                  return (
                    <tr key={key} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      <td className="px-3 py-3 align-middle text-sm font-medium text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          <PlatformIcon platform={row.platform} />
                          {platformLabel(row.platform, t)}
                        </span>
                      </td>
                      <td className="max-w-[12rem] px-3 py-3 align-middle text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <SocialMediaInsightAccountAvatar
                            avatarUrl={row.avatarUrl}
                            accountLabel={label}
                            organizationId={organizationId}
                            platform={row.platform}
                            accountId={row.accountId}
                          />
                          <span className="truncate font-medium text-gray-900">{label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
                        {audienceCell(row, t)}
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
                        {row.connected && !row.isPlatformPlaceholder
                          ? formatCount(row.contentCount)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
                        {row.connected && !row.isPlatformPlaceholder
                          ? formatCount(row.totalViews)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
                        {row.connected && !row.isPlatformPlaceholder
                          ? formatCount(row.totalLikes)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
                        {row.connected && !row.isPlatformPlaceholder
                          ? formatCount(row.totalComments)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
                        {row.connected && !row.isPlatformPlaceholder
                          ? formatCount(row.totalShares)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums text-gray-900">
                        {row.connected && !row.isPlatformPlaceholder
                          ? formatPercent(row.avgEngagementRate)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-sm tabular-nums">
                        {row.connected && !row.isPlatformPlaceholder ? (
                          row.hasUnmappedContent ? (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                                "bg-brand-red text-white",
                              )}
                            >
                              {row.matchedPlans}/{row.totalContent}
                            </span>
                          ) : (
                            <span className="text-gray-900">
                              {row.matchedPlans}/{row.totalContent}
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle text-sm">
                        {row.loading ? (
                          <Skeleton className="h-4 w-16" />
                        ) : row.error ? (
                          <span className="text-xs text-destructive">{row.error}</span>
                        ) : !row.connected ? (
                          <span className="text-xs text-muted-foreground">
                            {t("digitalMarketing.socialMediaInsightReport.statusNotConnected", "Not connected")}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-700">
                            {t("digitalMarketing.socialMediaInsightReport.statusConnected", "Connected")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle text-sm">
                        {!row.connected ? (
                          <Link
                            to={row.settingsPath}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {t("digitalMarketing.socialMediaInsightReport.openSettings", "Settings")}
                          </Link>
                        ) : row.isPlatformPlaceholder ? null : (
                          <Link
                            to={row.performancePath}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {t("digitalMarketing.socialMediaInsightReport.viewPerformance", "View")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {!isLoading && rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("digitalMarketing.socialMediaInsightReport.noData", "No account data for this period.")}
        </p>
      ) : null}
    </div>
  );
}
