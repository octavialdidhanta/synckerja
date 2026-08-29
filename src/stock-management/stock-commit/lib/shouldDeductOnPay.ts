import type { StockCommitPoint } from "../types/stockCommitPoint";

export {
  filterLinesForPayStock,
  computePayStockDelta,
  shouldSkipLegacySkuOnKitchen,
} from "./productStockCommitScope";

export function shouldDeductOnPay(args: {
  commitPoint: StockCommitPoint;
  hasUncommittedPayLines: boolean;
}): boolean {
  if (args.commitPoint === "pay") return true;
  if (args.commitPoint === "fulfillment") return false;
  return args.hasUncommittedPayLines;
}
