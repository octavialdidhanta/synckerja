import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { CategoryLayout } from "./orderCategoryLayout";
import type { WeeklyHourRule } from "./orderHours";
import type { OrderStoreMode } from "./orderUrls";

export type { CategoryLayout };

export type SynckerjaOrderOrgSettings = {
  organization_id: string;
  terms_accepted_at: string | null;
  terms_version: string | null;
  business_name: string;
  logo_path: string | null;
  cover_path: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  contact_instagram: string | null;
  terms_html: string | null;
  pickup_enabled: boolean;
  updated_at?: string;
};

export type SynckerjaOrderOutletSettings = {
  outlet_id: string;
  organization_id: string;
  enabled: boolean;
  public_code: string | null;
  timezone?: string;
  force_closed?: boolean;
  weekly_hours?: WeeklyHourRule[];
};

export type PublicOrderHours = {
  is_open: boolean;
  force_closed: boolean;
  open_hhmm: string | null;
  close_hhmm: string | null;
  next_open_hhmm: string | null;
  next_open_is_today: boolean;
  next_open_dow: number | null;
  next_open_at: string | null;
  closes_at: string | null;
};

export type SynckerjaOrderCatalogOptIn = {
  id: string;
  outlet_id: string;
  catalog_item_id: string;
  sort_order: number;
};

export type PublicOrderStore = {
  ok: boolean;
  error?: string;
  public_code?: string;
  outlet_id?: string;
  outlet_name?: string;
  business_name?: string;
  logo_path?: string | null;
  cover_path?: string | null;
  cover_url?: string | null;
  pickup_enabled?: boolean;
  is_open?: boolean;
  hours?: PublicOrderHours | null;
  table?: {
    id: string;
    name: string;
    pax: number;
    remaining_pax: number;
    join: "empty" | "join" | "full";
    session_id?: string | null;
  } | null;
  table_error?: string | null;
};

export type PublicOrderCatalogVariant = {
  id: string;
  name: string;
  price: number;
  out_of_stock?: boolean;
};

export type PublicOrderCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  photo_path: string | null;
  photo_url?: string | null;
  product_category_id: string | null;
  product_category_name: string | null;
  pos_status: string;
  kind: string;
  service_id: string | null;
  sub_service_id: string | null;
  track_stock: boolean;
  inventory_sku_id: string | null;
  available_qty: number | null;
  variants: PublicOrderCatalogVariant[];
  has_modifiers?: boolean;
  variant_count?: number;
};

export type PublicOrderModifierOption = {
  id: string;
  name: string;
  extra_price: number;
  out_of_stock: boolean;
};

export type PublicOrderModifierGroup = {
  id: string;
  name: string;
  is_required: boolean;
  min_selected: number;
  max_selected: number;
  single_select: boolean;
  option_qty_enabled?: boolean;
  options: PublicOrderModifierOption[];
};

export type PublicOrderIncludedItem = {
  name: string;
  quantity: number;
};

export type PublicOrderItemOptions = {
  ok: boolean;
  error?: string;
  kind: "product" | "bundle";
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  photo_path: string | null;
  photo_url?: string | null;
  variants: PublicOrderCatalogVariant[];
  modifier_groups: PublicOrderModifierGroup[];
  included_items: PublicOrderIncludedItem[];
};

export type PublicOrderCategory = {
  id: string;
  name: string;
  sort_order?: number;
  layout?: CategoryLayout;
  related_category_id?: string | null;
};

export type PublicOrderCatalog = {
  ok: boolean;
  error?: string;
  categories: PublicOrderCategory[];
  items: PublicOrderCatalogItem[];
  dine_in_sales_type_id: string | null;
  dine_in_sales_type_label: string;
};

export type OrderCartLine = CustomerVisitCartLine;

export type OrderCheckoutKind = "qris" | "pay_later";

export type OrderStorefrontContext = {
  code: string;
  mode: OrderStoreMode;
  tableNumber: string | null;
  category: string | null;
  categoryDetail: string | null;
};
