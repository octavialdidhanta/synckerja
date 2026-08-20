export type ProductRecipeLineDraft = {
  ingredient_id: string;
  quantity: number;
};

export type ProductRecipeDraft = {
  lines: ProductRecipeLineDraft[];
};

export type CatalogProductRecipeLine = ProductRecipeLineDraft & {
  sort_order: number;
};

export type CatalogProductRecipe = {
  id: string;
  organization_id: string;
  product_id: string;
  modifier_option_id: string | null;
  lines: CatalogProductRecipeLine[];
};

export type CatalogProductRecipeSave = {
  productId: string;
  modifierOptionId: string | null;
  lines: ProductRecipeLineDraft[];
};

export type ProductRecipeTargetProduct = {
  id: string;
  name: string;
  product_category_id: string | null;
  photo_url: string | null;
  outlet_ids: string[];
};

export type ProductRecipeVariantOption = {
  id: string;
  group_id: string;
  group_name: string;
  name: string;
};

export function emptyProductRecipeDraft(): ProductRecipeDraft {
  return { lines: [] };
}

export function productRecipeKey(productId: string, modifierOptionId: string | null): string {
  return `${productId}::${modifierOptionId ?? "__base__"}`;
}
