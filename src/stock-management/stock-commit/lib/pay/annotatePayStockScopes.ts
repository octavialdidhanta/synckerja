import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { productSalesStockMode } from "@/stock-management/catalog-ledger/lib/productSalesStockMode";
import type { StockCommitPoint } from "../../types/stockCommitPoint";

export type CatalogStockScope = "full" | "recipe_only" | "finished_goods_only";

export type PayStockScopedLine = CustomerVisitCartLine & {
  stockScope: CatalogStockScope;
};

/**
 * Annotate pay stock lines with RPC stock_scope.
 * Kitchen mode: retailTracked = FG only (avoid double recipe); recipeMenu = recipe_only.
 * Pay mode: full. Fulfillment: should not reach checkout stock.
 */
export function annotatePayStockScopes(args: {
  lines: CustomerVisitCartLine[];
  commitPoint: StockCommitPoint;
  hasBaseRecipeSet: Set<string>;
}): PayStockScopedLine[] {
  const { lines, commitPoint, hasBaseRecipeSet } = args;

  return lines
    .filter((line) => !line.isCustomAmount && line.kind === "product")
    .map((line) => {
      if (commitPoint === "pay") {
        return { ...line, stockScope: "full" as const };
      }
      if (commitPoint === "fulfillment") {
        return { ...line, stockScope: "finished_goods_only" as const };
      }

      const mode = productSalesStockMode({
        kind: line.kind,
        trackStock: line.trackStock,
        hasBaseRecipe: hasBaseRecipeSet.has(line.catalogId),
      });

      if (mode === "retailTracked") {
        return { ...line, stockScope: "finished_goods_only" as const };
      }
      if (mode === "recipeMenu") {
        return { ...line, stockScope: "recipe_only" as const };
      }
      // Legacy SKU / none: recipe_only if has recipe else full for offline SKU path
      if (hasBaseRecipeSet.has(line.catalogId)) {
        return { ...line, stockScope: "recipe_only" as const };
      }
      return { ...line, stockScope: "full" as const };
    });
}
