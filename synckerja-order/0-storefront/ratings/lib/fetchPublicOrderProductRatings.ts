import { supabase } from "@/shared/lib/supabaseClient";
import { normalizePublicCode } from "@/synckerja-order/shared/lib/publicCode";
import type {
  OrderProductRatingSummary,
  OrderProductReviewsPayload,
} from "./orderProductRatingTypes";

type SummaryRow = {
  catalog_item_id?: string;
  avg_rating?: number | string;
  rating_count?: number;
};

type ReviewsRpc = {
  ok?: boolean;
  error?: string;
  catalog_item_id?: string;
  avg_rating?: number | string | null;
  rating_count?: number;
  reviews?: Array<{
    id?: string;
    rating?: number;
    comment?: string;
    submitted_at?: string;
    reply_text?: string | null;
    replied_at?: string | null;
  }>;
  limit?: number;
  offset?: number;
};

function parseAvg(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function fetchPublicOrderProductRatingSummaries(args: {
  code: string;
  catalogItemIds: string[];
}): Promise<Map<string, OrderProductRatingSummary>> {
  const map = new Map<string, OrderProductRatingSummary>();
  const code = normalizePublicCode(args.code);
  const ids = args.catalogItemIds.filter(Boolean);
  if (!code || ids.length === 0) return map;

  const { data, error } = await supabase.rpc("get_public_order_product_rating_summaries", {
    p_code: code,
    p_catalog_item_ids: ids,
  });
  if (error) return map;

  const payload = (data ?? {}) as { ok?: boolean; summaries?: SummaryRow[] };
  if (!payload.ok || !Array.isArray(payload.summaries)) return map;

  for (const row of payload.summaries) {
    const id = String(row.catalog_item_id ?? "").trim();
    const avg = parseAvg(row.avg_rating);
    const count = Math.max(0, Math.round(Number(row.rating_count) || 0));
    if (!id || avg == null || count <= 0) continue;
    map.set(id, { catalogItemId: id, avgRating: avg, ratingCount: count });
  }
  return map;
}

export async function fetchPublicOrderProductReviews(args: {
  code: string;
  catalogItemId: string;
  limit?: number;
  offset?: number;
}): Promise<OrderProductReviewsPayload> {
  const empty: OrderProductReviewsPayload = {
    ok: false,
    error: "not_found",
    catalogItemId: args.catalogItemId,
    avgRating: null,
    ratingCount: 0,
    reviews: [],
    limit: args.limit ?? 20,
    offset: args.offset ?? 0,
  };

  const code = normalizePublicCode(args.code);
  const itemId = args.catalogItemId?.trim();
  if (!code || !itemId) return empty;

  const { data, error } = await supabase.rpc("get_public_order_product_reviews", {
    p_code: code,
    p_catalog_item_id: itemId,
    p_limit: args.limit ?? 20,
    p_offset: args.offset ?? 0,
  });
  if (error) return { ...empty, error: error.message };

  const payload = (data ?? {}) as ReviewsRpc;
  if (!payload.ok) {
    return { ...empty, error: payload.error ?? "not_found" };
  }

  return {
    ok: true,
    catalogItemId: String(payload.catalog_item_id ?? itemId),
    avgRating: parseAvg(payload.avg_rating),
    ratingCount: Math.max(0, Math.round(Number(payload.rating_count) || 0)),
    reviews: (payload.reviews ?? [])
      .map((r) => {
        const comment = String(r.comment ?? "").trim();
        if (!comment) return null;
        return {
          id: String(r.id ?? ""),
          rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))),
          comment,
          submittedAt: String(r.submitted_at ?? ""),
          replyText: r.reply_text?.trim() ? String(r.reply_text).trim() : null,
          repliedAt: r.replied_at ? String(r.replied_at) : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.id)),
    limit: Number(payload.limit) || args.limit || 20,
    offset: Number(payload.offset) || args.offset || 0,
  };
}
