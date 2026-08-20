export type CatalogPromoType = "discount_per_item" | "free_item";
export type CatalogPromoSalesTypeScope = "all" | "specific";
export type CatalogPromoRequirementKind = "item" | "category";
export type CatalogPromoAmountUnit = "rp" | "percent";
export type PromoListStatus = "scheduled" | "ongoing" | "inactive";
export type PromoListStatusFilter = "all" | PromoListStatus;

export type CatalogPromoRequirement = {
  id?: string;
  kind: CatalogPromoRequirementKind;
  quantity: number;
  product_id: string | null;
  category_id: string | null;
};

export type CatalogPromo = {
  id: string;
  organization_id: string;
  name: string;
  promo_type: CatalogPromoType;
  sales_type_scope: CatalogPromoSalesTypeScope;
  sales_type_ids: string[];
  outlet_ids: string[];
  applies_in_multiple: boolean;
  time_period_enabled: boolean;
  starts_on: string | null;
  ends_on: string | null;
  starts_at_time: string | null;
  ends_at_time: string | null;
  reward_amount_unit: CatalogPromoAmountUnit | null;
  reward_amount_value: number | null;
  reward_product_id: string | null;
  reward_quantity: number;
  sort_order: number;
  is_active: boolean;
  requirements: CatalogPromoRequirement[];
};

export type CatalogPromoSave = {
  id?: string;
  name: string;
  promo_type: CatalogPromoType;
  sales_type_scope: CatalogPromoSalesTypeScope;
  sales_type_ids: string[];
  outlet_ids: string[];
  applies_in_multiple: boolean;
  time_period_enabled: boolean;
  starts_on: string | null;
  ends_on: string | null;
  starts_at_time: string | null;
  ends_at_time: string | null;
  reward_amount_unit: CatalogPromoAmountUnit | null;
  reward_amount_value: number | null;
  reward_product_id: string | null;
  reward_quantity: number;
  requirements: CatalogPromoRequirement[];
};

export type PromoRequirementDraft = {
  key: string;
  quantity: string;
  product_id: string;
  category_id: string;
};

export type PromoDraft = {
  id?: string;
  name: string;
  promo_type: CatalogPromoType;
  sales_type_scope: CatalogPromoSalesTypeScope;
  sales_type_ids: string[];
  outlet_ids: string[];
  requirement_kind: CatalogPromoRequirementKind;
  requirements: PromoRequirementDraft[];
  reward_amount_unit: CatalogPromoAmountUnit;
  reward_amount_display: string;
  reward_product_id: string;
  reward_quantity: string;
  applies_in_multiple: boolean;
  time_period_enabled: boolean;
  starts_on: string;
  ends_on: string;
  starts_at_time: string;
  ends_at_time: string;
};

export function newRequirementDraft(): PromoRequirementDraft {
  return {
    key: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quantity: "1",
    product_id: "",
    category_id: "",
  };
}

export function emptyPromoDraft(): PromoDraft {
  return {
    name: "",
    promo_type: "discount_per_item",
    sales_type_scope: "all",
    sales_type_ids: [],
    outlet_ids: [],
    requirement_kind: "item",
    requirements: [newRequirementDraft()],
    reward_amount_unit: "rp",
    reward_amount_display: "",
    reward_product_id: "",
    reward_quantity: "1",
    applies_in_multiple: false,
    time_period_enabled: false,
    starts_on: "",
    ends_on: "",
    starts_at_time: "",
    ends_at_time: "",
  };
}
