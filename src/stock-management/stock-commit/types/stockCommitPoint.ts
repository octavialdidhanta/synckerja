export const STOCK_COMMIT_POINTS = ["pay", "kitchen", "fulfillment"] as const;

export type StockCommitPoint = (typeof STOCK_COMMIT_POINTS)[number];

export const DEFAULT_STOCK_COMMIT_POINT: StockCommitPoint = "pay";

export function isStockCommitPoint(value: string | null | undefined): value is StockCommitPoint {
  return STOCK_COMMIT_POINTS.includes(value as StockCommitPoint);
}

export function parseStockCommitPoint(value: string | null | undefined): StockCommitPoint {
  return isStockCommitPoint(value) ? value : DEFAULT_STOCK_COMMIT_POINT;
}
