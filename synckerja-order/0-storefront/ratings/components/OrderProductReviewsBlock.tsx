import { format } from "date-fns";
import { Star } from "lucide-react";
import { useState } from "react";
import { usePublicOrderProductReviews } from "../hooks/usePublicOrderProductReviews";
import {
  formatOrderAvgRating,
  formatOrderRatingCount,
} from "../lib/formatOrderRatingCount";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";

function StarsRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

/** Shopee-style reviews block for item detail (good ratings with comments). */
export function OrderProductReviewsBlock({
  code,
  catalogItemId,
}: {
  code: string;
  catalogItemId: string;
}) {
  const [limit, setLimit] = useState(20);
  const query = usePublicOrderProductReviews({
    code,
    catalogItemId,
    limit,
    offset: 0,
  });

  const data = query.data;
  if (query.isLoading && limit === 20) {
    return (
      <section className={`border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
        <p className="text-[12px] text-neutral-400">Loading ratings…</p>
      </section>
    );
  }

  if (!data?.ok || data.ratingCount <= 0) return null;

  const avg = data.avgRating ?? 0;
  const hasMore = data.reviews.length >= limit;

  return (
    <section className={`border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
        <p className="text-[14px] font-semibold text-neutral-900">
          <span className="tabular-nums">{formatOrderAvgRating(avg)}</span>
          <span className="mx-1.5 text-neutral-300">·</span>
          <span className="font-medium text-neutral-600">
            {formatOrderRatingCount(data.ratingCount)} ratings
          </span>
        </p>
      </div>

      {data.reviews.length === 0 ? (
        <p className="text-[12px] text-neutral-400">No written reviews yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {data.reviews.map((review) => {
            let dateLabel = "";
            try {
              const d = new Date(review.submittedAt);
              if (!Number.isNaN(d.getTime())) dateLabel = format(d, "dd MMM");
            } catch {
              dateLabel = "";
            }
            return (
              <li key={review.id} className="py-3 first:pt-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-neutral-800">Pelanggan</p>
                  {dateLabel ? (
                    <p className="text-[11px] tabular-nums text-neutral-400">{dateLabel}</p>
                  ) : null}
                </div>
                <StarsRow rating={review.rating} />
                <p className="mt-1.5 text-[13px] leading-snug text-neutral-700">
                  {review.comment}
                </p>
                {review.replyText ? (
                  <div className="mt-2 rounded-md bg-neutral-100 px-2.5 py-2">
                    <p className="mb-0.5 text-[11px] font-semibold text-neutral-500">
                      Reply from business
                    </p>
                    <p className="text-[12px] leading-snug text-neutral-700">{review.replyText}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore ? (
        <button
          type="button"
          className="mt-2 text-[12px] font-medium text-[#E86B2A]"
          disabled={query.isFetching}
          onClick={() => setLimit((n) => n + 20)}
        >
          {query.isFetching ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
