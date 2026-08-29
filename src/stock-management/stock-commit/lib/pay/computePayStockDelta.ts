import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { productSalesStockMode } from "@/stock-management/catalog-ledger/lib/productSalesStockMode";
import type { StockCommitPoint } from "../../types/stockCommitPoint";
import type { PosSessionStockCommit } from "../../types/sessionStockCommit";
import { cartLineCommitFingerprint, indexCartLines } from "../computeCommitDelta";

export type PayStockDeltaLine = {
  line: CustomerVisitCartLine;
  payQty: number;
  committedQty: number;
  cartQty: number;
};

function resolvePayQtyForLine(args: {
  line: CustomerVisitCartLine;
  commitPoint: StockCommitPoint;
  committedQty: number;
  hasBaseRecipe: boolean;
}): number {
  const { line, commitPoint, committedQty, hasBaseRecipe } = args;
  const cartQty = Number(line.quantity) || 0;
  if (cartQty <= 0) return 0;

  if (commitPoint === "pay") return cartQty;
  if (commitPoint === "fulfillment") return 0;

  const uncommittedQty = Math.max(0, cartQty - committedQty);
  const mode = productSalesStockMode({
    kind: line.kind,
    trackStock: line.trackStock,
    hasBaseRecipe,
  });

  if (mode === "retailTracked") return cartQty;

  if (mode === "recipeMenu") {
    return uncommittedQty;
  }

  if (line.inventorySkuId && uncommittedQty > 0) {
    return uncommittedQty;
  }

  return 0;
}

export function computePayStockDelta(args: {
  lines: CustomerVisitCartLine[];
  commitPoint: StockCommitPoint;
  commits: PosSessionStockCommit[];
  hasBaseRecipeSet: Set<string>;
}): CustomerVisitCartLine[] {
  if (args.commitPoint === "fulfillment") return [];
  if (args.commitPoint === "pay") {
    return args.lines.filter((line) => !line.isCustomAmount);
  }

  const commitByFp = new Map<string, PosSessionStockCommit>();
  for (const c of args.commits) {
    commitByFp.set(c.line_fingerprint, c);
  }

  const result: CustomerVisitCartLine[] = [];

  for (const { line, lineFingerprint } of indexCartLines(args.lines)) {
    const committed = commitByFp.get(lineFingerprint);
    const committedQty = committed ? Number(committed.committed_qty) || 0 : 0;
    const hasBaseRecipe = args.hasBaseRecipeSet.has(line.catalogId);
    const payQty = resolvePayQtyForLine({
      line,
      commitPoint: args.commitPoint,
      committedQty,
      hasBaseRecipe,
    });

    if (payQty <= 0) continue;

    result.push({
      ...line,
      quantity: payQty,
    });
  }

  return result;
}

export function computePayStockDeltaDetailed(args: {
  lines: CustomerVisitCartLine[];
  commitPoint: StockCommitPoint;
  commits: PosSessionStockCommit[];
  hasBaseRecipeSet: Set<string>;
}): PayStockDeltaLine[] {
  if (args.commitPoint === "fulfillment") return [];

  const commitByFp = new Map<string, PosSessionStockCommit>();
  for (const c of args.commits) {
    commitByFp.set(c.line_fingerprint, c);
  }

  const deltas: PayStockDeltaLine[] = [];

  for (const { line, lineFingerprint } of indexCartLines(args.lines)) {
    const cartQty = Number(line.quantity) || 0;
    const committed = commitByFp.get(lineFingerprint);
    const committedQty = committed ? Number(committed.committed_qty) || 0 : 0;
    const hasBaseRecipe = args.hasBaseRecipeSet.has(line.catalogId);
    const payQty = resolvePayQtyForLine({
      line,
      commitPoint: args.commitPoint,
      committedQty,
      hasBaseRecipe,
    });

    if (payQty <= 0) continue;

    deltas.push({ line, payQty, committedQty, cartQty });
  }

  return deltas;
}

/** @deprecated Use computePayStockDelta — kept for re-export compatibility. */
export function filterLinesForPayStock(args: {
  lines: CustomerVisitCartLine[];
  commitPoint: StockCommitPoint;
  commits: PosSessionStockCommit[];
  hasBaseRecipeSet?: Set<string>;
}): CustomerVisitCartLine[] {
  return computePayStockDelta({
    ...args,
    hasBaseRecipeSet: args.hasBaseRecipeSet ?? new Set(),
  });
}
