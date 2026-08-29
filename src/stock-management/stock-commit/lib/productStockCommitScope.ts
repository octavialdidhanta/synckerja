import {
  productSalesStockMode,
  type ProductSalesStockMode,
} from "@/stock-management/catalog-ledger/lib/productSalesStockMode";
import type { StockCommitPoint } from "../types/stockCommitPoint";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export function productStockCommitScope(args: {
  line: Pick<CustomerVisitCartLine, "kind" | "trackStock">;
  hasBaseRecipe?: boolean;
  commitPoint: StockCommitPoint;
  phase: "kitchen" | "pay" | "fulfillment";
}): ProductSalesStockMode | "skip" {
  const mode = productSalesStockMode({
    kind: args.line.kind,
    trackStock: args.line.trackStock,
    hasBaseRecipe: args.hasBaseRecipe,
  });

  if (args.commitPoint === "pay") {
    return args.phase === "pay" ? mode : "skip";
  }

  if (args.commitPoint === "kitchen") {
    if (args.phase === "kitchen") {
      return mode === "recipeMenu" ? "recipeMenu" : "skip";
    }
    if (args.phase === "pay") {
      return mode === "retailTracked" ? "retailTracked" : "skip";
    }
    return "skip";
  }

  if (args.commitPoint === "fulfillment") {
    if (args.phase === "fulfillment") {
      return mode === "retailTracked" ? "retailTracked" : "skip";
    }
    if (args.phase === "pay") {
      return "skip";
    }
    return "skip";
  }

  return "skip";
}

export function shouldSkipLegacySkuOnKitchen(commitPoint: StockCommitPoint): boolean {
  return commitPoint === "kitchen";
}

export { filterLinesForPayStock, computePayStockDelta } from "./pay/computePayStockDelta";
