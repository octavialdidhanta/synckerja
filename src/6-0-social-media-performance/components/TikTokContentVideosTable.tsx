import { useTranslation } from "react-i18next";
import type { TikTokContentVideoRow } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";

type TikTokContentVideosTableProps = {
  rows: TikTokContentVideoRow[];
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

export function TikTokContentVideosTable({ rows }: TikTokContentVideosTableProps) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("digitalMarketing.tiktokContent.noVideos", "No videos for this period.")}
      </p>
    );
  }

  return (
    <div className="min-h-0 overflow-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-200 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.tiktokContent.colVideo", "Video")}</th>
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.tiktokContent.colService", "Service")}</th>
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.tiktokContent.colPillar", "Pillar")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.tiktokContent.colViews", "Views")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.tiktokContent.colLikes", "Likes")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.tiktokContent.colComments", "Comments")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.tiktokContent.colShares", "Shares")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("digitalMarketing.tiktokContent.colEngagement", "Engagement")}</th>
            <th className="px-3 py-2 font-medium">{t("digitalMarketing.tiktokContent.colPosted", "Posted")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.video_id} className="border-b border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {row.cover_image_url ? (
                    <img
                      src={row.cover_image_url}
                      alt=""
                      className="h-10 w-8 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{row.title || row.video_id}</p>
                    {row.share_url ? (
                      <a
                        href={row.share_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-primary hover:underline"
                      >
                        {t("digitalMarketing.tiktokContent.openOnTikTok", "Open on TikTok")}
                      </a>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.service_name ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.content_pillar ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.view_count)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.like_count)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.comment_count)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.share_count)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPercent(row.engagement_rate)}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(row.posted_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
