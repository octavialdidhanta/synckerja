export type PosLibraryCategoryOrderRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  category_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PosLibraryCategoryMeta = {
  id: string;
  name: string;
  sort_order: number;
};

export type PosLibrarySystemSectionId = "discount" | "all_products" | "all_bundles";

export type PosLibrarySection =
  | {
      kind: "system";
      id: PosLibrarySystemSectionId;
      labelKey: string;
      fallbackLabel: string;
    }
  | {
      kind: "category";
      id: string;
      name: string;
    };
