export type OrderProductRatingSummary = {
  catalogItemId: string;
  avgRating: number;
  ratingCount: number;
};

export type OrderProductReview = {
  id: string;
  rating: number;
  comment: string;
  submittedAt: string;
  replyText: string | null;
  repliedAt: string | null;
};

export type OrderProductReviewsPayload = {
  ok: boolean;
  error?: string;
  catalogItemId: string;
  avgRating: number | null;
  ratingCount: number;
  reviews: OrderProductReview[];
  limit: number;
  offset: number;
};
