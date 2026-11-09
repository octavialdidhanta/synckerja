export type RecipeDraftStatus = "pending" | "published" | "rejected" | "superseded" | "expired";

export type RecipeDraftChange = "same" | "changed" | "new" | "removed";

/** One ingredient row of a draft review, as returned by get_recipe_draft_review. Quantities are in unit_code. */
export type RecipeDraftReviewRow = {
  ingredient_id: string;
  name: string;
  unit_code: string | null;
  kind: string | null;
  deleted: boolean;
  unit_cost: number;
  has_cost: boolean;
  before_qty: number | null;
  after_qty: number | null;
  before_cost: number;
  after_cost: number;
  delta_cost: number;
  change: RecipeDraftChange;
  unusual: boolean;
};

export type RecipeDraftNotice = {
  code: string;
  items?: string[];
  percent?: number;
  status?: RecipeDraftStatus;
};

export type RecipeDraftReview = {
  draft: {
    id: string;
    status: RecipeDraftStatus;
    draft_type: "new" | "update";
    source: "claude" | "app";
    product_id: string;
    product_name: string;
    category: string | null;
    outlet_id: string;
    outlet_name: string | null;
    request_note: string | null;
    requested_by_name: string | null;
    created_at: string;
    edited: boolean;
    edited_by_name: string | null;
    edited_at: string | null;
    expires_at: string;
    decided_at: string | null;
    decided_by_name: string | null;
    decision_note: string | null;
  };
  can_manage: boolean;
  has_live_recipe: boolean;
  selling_price: number;
  finished_goods_cost: boolean;
  rows: RecipeDraftReviewRow[];
  totals: {
    hpp_before: number | null;
    hpp_after: number;
    delta: number | null;
    margin_before: number | null;
    margin_after: number;
    margin_pct_before: number | null;
    margin_pct_after: number | null;
  };
  warnings: RecipeDraftNotice[];
  blocking: RecipeDraftNotice[];
  requires_confirmation: boolean;
  can_publish: boolean;
};

export type RecipeDraftListItem = {
  id: string;
  product_id: string;
  outlet_id: string | null;
  outlet_name: string | null;
  product_name: string;
  draft_type: "new" | "update";
  status: RecipeDraftStatus;
  requested_by_name: string | null;
  request_note: string | null;
  created_at: string;
  edited: boolean;
  line_count: number;
  hpp_before: number | null;
  hpp_after: number | null;
  warning_count: number;
  blocked: boolean;
};
