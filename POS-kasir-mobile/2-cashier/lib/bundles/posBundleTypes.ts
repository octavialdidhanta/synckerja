export type PosOutletBundleSalesTypePrice = {
  salesTypeId: string;
  price: number;
};

export type PosOutletBundleItem = {
  productId: string;
  quantity: number;
};

/** Read-only POS view of an active, outlet-assigned catalog bundle. */
export type PosOutletBundle = {
  id: string;
  name: string;
  photoUrl: string | null;
  bundlePrice: number;
  useSalesTypePrices: boolean;
  salesTypePrices: PosOutletBundleSalesTypePrice[];
  items: PosOutletBundleItem[];
};
