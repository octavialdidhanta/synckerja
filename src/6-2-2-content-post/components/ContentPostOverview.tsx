import { BarChart3, HandCoins, Megaphone } from "lucide-react";
import type { ContentPostRecord } from "@/shared/types/content-post";

export const ContentPostOverview = ({
  posts,
  conversionByPostId,
}: {
  posts: ContentPostRecord[];
  conversionByPostId: Record<string, { count: number; value: number }>;
}) => {
  const totalConversion = posts.reduce((acc, post) => acc + (conversionByPostId[post.id]?.count || 0), 0);
  const totalValue = posts.reduce((acc, post) => acc + (conversionByPostId[post.id]?.value || 0), 0);
  const topPlatform = Object.entries(
    posts.reduce<Record<string, number>>((acc, post) => {
      const key = (post.platform || "unknown").toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-brand-blue/20 bg-brand-blue-soft p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-brand-blue-on-soft">
          <BarChart3 className="h-4 w-4 text-brand-blue" />
          Total Conversion
        </div>
        <div className="text-xl font-semibold text-brand-blue-deep">{totalConversion}</div>
      </div>

      <div className="rounded-md border border-brand-blue/25 bg-brand-blue/5 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-brand-blue-on-soft">
          <HandCoins className="h-4 w-4 text-brand-blue" />
          Conversion Value
        </div>
        <div className="text-xl font-semibold text-brand-blue-deep">
          Rp {Math.round(totalValue).toLocaleString("id-ID")}
        </div>
      </div>

      <div className="rounded-md border border-brand-blue/20 bg-brand-blue-soft/80 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-brand-blue-on-soft">
          <Megaphone className="h-4 w-4 text-brand-blue" />
          Top Platform
        </div>
        <div className="text-sm font-semibold uppercase text-brand-blue-deep">{topPlatform?.[0] || "-"}</div>
      </div>
    </div>
  );
};
