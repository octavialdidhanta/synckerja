export type CatalogDiscountInputConfiguration = "fixed" | "customizable";
export type CatalogDiscountAmountUnit = "rp" | "percent";

export type CatalogDiscount = {
  id: string;
  organization_id: string;
  name: string;
  input_configuration: CatalogDiscountInputConfiguration;
  amount_unit: CatalogDiscountAmountUnit | null;
  amount_value: number | null;
  sort_order: number;
  is_active: boolean;
  outlet_ids: string[];
};

export type CatalogDiscountSave = {
  id?: string;
  name: string;
  input_configuration: CatalogDiscountInputConfiguration;
  amount_unit: CatalogDiscountAmountUnit | null;
  amount_value: number | null;
  outlet_ids: string[];
};
