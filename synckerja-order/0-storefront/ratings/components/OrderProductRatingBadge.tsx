import { Star } from "lucide-react";
import type { OrderProductRatingSummary } from "../lib/orderProductRatingTypes";
import {
  formatOrderAvgRating,
  formatOrderRatingCount,
} from "../lib/formatOrderRatingCount";

/** GoFood-style compact badge for menu cards. Always reserves one line height. */
export function OrderProductRatingBadge({
  summary,
  className,
}: {
  summary: OrderProductRatingSummary | null | undefined;
  className?: string;
}) {
  const hasRating = Boolean(summary && summary.ratingCount > 0);

  return (
    <p
      className={`flex h-3.5 items-center gap-0.5 text-[10px] font-medium leading-none text-neutral-600 ${className ?? ""}`}
      aria-hidden={!hasRating}
    >
      {hasRating && summary ? (
        <>
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" aria-hidden />
          <span className="tabular-nums text-neutral-800">
            {formatOrderAvgRating(summary.avgRating)}
          </span>
          <span className="tabular-nums text-neutral-400">
            ({formatOrderRatingCount(summary.ratingCount)})
          </span>
        </>
      ) : (
        <span className="invisible select-none" aria-hidden>
          ★ 0.0 (0)
        </span>
      )}
    </p>
  );
}
