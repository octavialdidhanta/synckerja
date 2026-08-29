import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { assertCheckoutIngredientStockOrThrow } from "@/stock-management/catalog-ledger/lib/assertCheckoutIngredientStockClient";
import {
  findInsufficientStoreCheckoutStock,
  trackedStoreCheckoutLines,
} from "@/5-2-customer-visits/checkout/lib/storeCheckoutStock";
import type { StockCommitPoint } from "../types/stockCommitPoint";
import type { PosSessionStockCommit } from "../types/sessionStockCommit";
import {
  buildKitchenCommitRpcLines,
  buildReverseRpcLines,
  deltaLinesToCartLines,
} from "./buildCommitLinesPayload";
import { computeCommitDelta } from "./computeCommitDelta";
import { computePayStockDelta } from "./pay/computePayStockDelta";
import { annotatePayStockScopes, type PayStockScopedLine } from "./pay/annotatePayStockScopes";
import { resolveStockCommitPolicy } from "./resolveStockCommitPolicy";
import { fetchProductIdsWithBaseRecipe } from "./recipe/fetchProductIdsWithBaseRecipe";
import { fetchSessionStockCommits } from "../hooks/usePosSessionStockCommits";
import { reserveTargetLinesFromCart } from "./reserve/computeReserveDelta";
import { releaseAllFulfillmentReserveForSession } from "./reserve/releaseFulfillmentReserve";
import { sessionAlreadyFulfilled } from "./reserve/sessionAlreadyFulfilled";
import { filterKitchenCommitLines } from "./kitchen/filterKitchenCommitLines";
import { resolveVoidReverseLine } from "./void/resolveVoidReverseLine";
import {
  applyCatalogKitchenCommitStock,
  reverseCatalogKitchenCommit,
} from "../rpc/applyCatalogKitchenCommitStock";

export type KitchenStockCommitResult = {
  committed: boolean;
  deltaCount: number;
};

export async function commitKitchenStockIfNeeded(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  cartLines: CustomerVisitCartLine[];
  commitPoint?: StockCommitPoint;
  existingCommits?: PosSessionStockCommit[];
}): Promise<KitchenStockCommitResult> {
  const commitPoint =
    args.commitPoint ??
    (await resolveStockCommitPolicy({
      organizationId: args.organizationId,
      outletId: args.outletId,
    }));

  if (commitPoint !== "kitchen") {
    return { committed: false, deltaCount: 0 };
  }

  const commits =
    args.existingCommits ?? (await fetchSessionStockCommits(args.sessionId));
  const rawDeltas = computeCommitDelta(args.cartLines, commits);
  if (rawDeltas.length === 0) {
    return { committed: false, deltaCount: 0 };
  }

  const productIds = rawDeltas.map((d) => d.line.catalogId);
  const hasBaseRecipeSet = await fetchProductIdsWithBaseRecipe({
    organizationId: args.organizationId,
    productIds,
  });
  const deltas = filterKitchenCommitLines(rawDeltas, hasBaseRecipeSet);
  if (deltas.length === 0) {
    return { committed: false, deltaCount: 0 };
  }

  const deltaCartLines = deltaLinesToCartLines(deltas);
  await assertCheckoutIngredientStockOrThrow({
    outletId: args.outletId,
    lines: deltaCartLines,
  });

  const rpcLines = buildKitchenCommitRpcLines(deltas);
  await applyCatalogKitchenCommitStock({
    organizationId: args.organizationId,
    outletId: args.outletId,
    sessionId: args.sessionId,
    lines: rpcLines,
  });

  return { committed: true, deltaCount: deltas.length };
}

export async function reverseKitchenStockForVoid(args: {
  organizationId: string;
  sessionId: string;
  line: CustomerVisitCartLine;
  voidQty: number;
  reverseId: string;
  existingCommits?: PosSessionStockCommit[];
}): Promise<boolean> {
  const commits =
    args.existingCommits ?? (await fetchSessionStockCommits(args.sessionId));
  const reverse = resolveVoidReverseLine({
    line: args.line,
    voidQty: args.voidQty,
    commits,
  });
  if (!reverse) return false;

  const rpcLine = buildReverseRpcLines({
    line: args.line,
    lineIndex: reverse.lineIndex,
    reverseQty: reverse.reverseQty,
    lineFingerprint: reverse.lineFingerprint,
  });

  await reverseCatalogKitchenCommit({
    organizationId: args.organizationId,
    sessionId: args.sessionId,
    reverseId: args.reverseId,
    lines: [{ ...rpcLine, qty: reverse.reverseQty }],
  });

  return true;
}

export async function reverseAllKitchenStockForSession(args: {
  organizationId: string;
  sessionId: string;
  reverseId: string;
}): Promise<void> {
  await reverseCatalogKitchenCommit({
    organizationId: args.organizationId,
    sessionId: args.sessionId,
    reverseId: args.reverseId,
    lines: null,
  });
}

export async function resolvePayStockLines(args: {
  lines: CustomerVisitCartLine[];
  organizationId: string;
  outletId: string;
  sessionId?: string | null;
  commitPoint?: StockCommitPoint;
  existingCommits?: PosSessionStockCommit[];
}): Promise<CustomerVisitCartLine[]> {
  const commitPoint =
    args.commitPoint ??
    (await resolveStockCommitPolicy({
      organizationId: args.organizationId,
      outletId: args.outletId,
    }));

  const commits =
    args.existingCommits ??
    (args.sessionId ? await fetchSessionStockCommits(args.sessionId) : []);

  const productIds = args.lines
    .filter((l) => !l.isCustomAmount && l.kind === "product")
    .map((l) => l.catalogId);
  const hasBaseRecipeSet = await fetchProductIdsWithBaseRecipe({
    organizationId: args.organizationId,
    productIds,
  });

  return computePayStockDelta({
    lines: args.lines,
    commitPoint,
    commits,
    hasBaseRecipeSet,
  });
}

/** Pay stock lines with stock_scope for checkout RPC. */
export async function resolvePayStockScopedLines(args: {
  lines: CustomerVisitCartLine[];
  organizationId: string;
  outletId: string;
  sessionId?: string | null;
  commitPoint?: StockCommitPoint;
  existingCommits?: PosSessionStockCommit[];
}): Promise<PayStockScopedLine[]> {
  const commitPoint =
    args.commitPoint ??
    (await resolveStockCommitPolicy({
      organizationId: args.organizationId,
      outletId: args.outletId,
    }));

  const commits =
    args.existingCommits ??
    (args.sessionId ? await fetchSessionStockCommits(args.sessionId) : []);

  const productIds = args.lines
    .filter((l) => !l.isCustomAmount && l.kind === "product")
    .map((l) => l.catalogId);
  const hasBaseRecipeSet = await fetchProductIdsWithBaseRecipe({
    organizationId: args.organizationId,
    productIds,
  });

  const payLines = computePayStockDelta({
    lines: args.lines,
    commitPoint,
    commits,
    hasBaseRecipeSet,
  });

  return annotatePayStockScopes({
    lines: payLines,
    commitPoint,
    hasBaseRecipeSet,
  });
}

export async function assertStockForPayLines(args: {
  lines: CustomerVisitCartLine[];
  outletId: string;
}): Promise<void> {
  const tracked = trackedStoreCheckoutLines(args.lines);
  if (tracked.length > 0) {
    const catalogInsufficient = findInsufficientStoreCheckoutStock(tracked);
    if (catalogInsufficient) throw new Error("store_checkout_insufficient_stock");
  }
  await assertCheckoutIngredientStockOrThrow({
    outletId: args.outletId,
    lines: args.lines,
  });
}

export async function reserveFulfillmentStockIfNeeded(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  cartLines: CustomerVisitCartLine[];
}): Promise<void> {
  const { applyCatalogStockReserve } = await import("../rpc/applyCatalogStockReserve");
  const commitPoint = await resolveStockCommitPolicy({
    organizationId: args.organizationId,
    outletId: args.outletId,
  });
  if (commitPoint !== "fulfillment") return;

  if (
    await sessionAlreadyFulfilled({
      organizationId: args.organizationId,
      sessionId: args.sessionId,
    })
  ) {
    return;
  }

  const lines = reserveTargetLinesFromCart(args.cartLines).map((l) => ({
    product_id: l.product_id,
    qty: l.qty,
    variant_id: l.variant_id,
  }));
  if (lines.length === 0) return;

  await applyCatalogStockReserve({
    organizationId: args.organizationId,
    outletId: args.outletId,
    sessionId: args.sessionId,
    lines,
  });
}

export async function cancelSessionStockByPolicy(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  reverseId?: string;
}): Promise<void> {
  const commitPoint = await resolveStockCommitPolicy({
    organizationId: args.organizationId,
    outletId: args.outletId,
  });

  if (commitPoint === "kitchen") {
    await reverseAllKitchenStockForSession({
      organizationId: args.organizationId,
      sessionId: args.sessionId,
      reverseId: args.reverseId ?? `cancel-${args.sessionId}`,
    });
    return;
  }

  if (commitPoint === "fulfillment") {
    await releaseAllFulfillmentReserveForSession({
      organizationId: args.organizationId,
      outletId: args.outletId,
      sessionId: args.sessionId,
      releaseId: args.reverseId ?? `cancel-${args.sessionId}`,
    });
  }
}

export { releaseAllFulfillmentReserveForSession } from "./reserve/releaseFulfillmentReserve";
export { reversePaidCheckoutStock } from "./pay/reversePaidCheckoutStock";
export { resolveVoidReverseLine } from "./void/resolveVoidReverseLine";
export { filterKitchenCommitLines } from "./kitchen/filterKitchenCommitLines";
export { annotatePayStockScopes } from "./pay/annotatePayStockScopes";
export { sessionAlreadyFulfilled } from "./reserve/sessionAlreadyFulfilled";
