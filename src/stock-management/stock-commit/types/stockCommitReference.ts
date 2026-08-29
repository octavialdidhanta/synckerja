export const STOCK_COMMIT_REFERENCE_TYPES = {
  storeCheckout: "store_checkout",
  storeCheckoutReverse: "store_checkout_reverse",
  kitchenCommit: "pos_kitchen_commit",
  kitchenReverse: "pos_kitchen_reverse",
  fulfillment: "pos_fulfillment",
  stockReserve: "pos_stock_reserve",
} as const;

export type StockCommitReferenceType =
  (typeof STOCK_COMMIT_REFERENCE_TYPES)[keyof typeof STOCK_COMMIT_REFERENCE_TYPES];
