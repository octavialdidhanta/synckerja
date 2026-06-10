import { useTranslation } from "react-i18next";
import type { YouTubeContentVideoRow } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";

type YouTubeContentVideosTableProps = {
  rows: YouTubeContentVideoRow[];
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatPercent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

export function YouTubeContentVideosTable({ rows }: YouTubeContentVideosTableProps) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("digitalMarketing.youtubeContent.noVideos", "No videos for this period.")}
      </p>
    );
  }

  return (
    <div className="min-h-0 overflow-auto">
      <table className="w-full min-w-[1040px] table-fixed text-sm">
        <colgroup>
          <col className="w-[220px]" />
          <col className="w-[160px]" />
          <col className="w-[96px]" />
          <col className="w-[96px]" />
          <col className="w-[72px]" />
          <col className="w-[64px]" />
          <col className="w-[80px]" />
          <col className="w-[64px]" />
          <col className="w-[88px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-200 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.youtubeContent.colVideo", "Video")}</th>
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.youtubeContent.colLink", "Link")}</th>
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.youtubeContent.colService", "Service")}</th>
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.youtubeContent.colPillar", "Pillar")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.youtubeContent.colViews", "Views")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.youtubeContent.colLikes", "Likes")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.youtubeContent.colComments", "Comments")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.youtubeContent.colShares", "Shares")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.youtubeContent.colEngagement", "Engagement")}</th>
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.youtubeContent.colPosted", "Posted")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const title = row.title || row.video_id;
            return (
              <tr key={row.video_id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="max-w-[220px] overflow-hidden px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {row.cover_image_url ? (
                      <img
                        src={row.cover_image_url}
                        alt=""
                        className="h-10 w-8 shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate font-medium text-gray-900" title={title}>
                        {title}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[160px] overflow-hidden px-3 py-2">
                  {row.share_url ? (
                    <a
                      href={row.share_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-primary hover:underline"
                      title={row.share_url}
                    >
                      {row.share_url}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="max-w-[96px] truncate px-3 py-2 text-muted-foreground" title={row.service_name ?? undefined}>
                  {row.service_name ?? "—"}
                </td>
                <td className="max-w-[96px] truncate px-3 py-2 text-muted-foreground" title={row.content_pillar ?? undefined}>
                  {row.content_pillar ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.view_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.like_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.comment_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.share_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPercent(row.engagement_rate)}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(row.posted_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
