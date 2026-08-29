import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { CommitDeltaLine } from "./computeCommitDelta";

export type KitchenCommitRpcLine = {
  product_id: string;
  qty: number;
  variant_id: string | null;
  modifier_option_ids: string[];
  line_key: string;
  line_fingerprint: string;
  line_index: number;
};

export function buildKitchenCommitRpcLines(deltas: CommitDeltaLine[]): KitchenCommitRpcLine[] {
  return deltas.map((d) => ({
    product_id: d.line.catalogId,
    qty: d.deltaQty,
    variant_id: d.line.variantId ?? null,
    modifier_option_ids: (d.line.modifiers ?? [])
      .map((m) => m.optionId)
      .filter(Boolean),
    line_key: `L${d.lineIndex}`,
    line_fingerprint: d.lineFingerprint,
    line_index: d.lineIndex,
  }));
}

export function buildReverseRpcLines(args: {
  line: CustomerVisitCartLine;
  lineIndex: number;
  reverseQty: number;
  lineFingerprint: string;
}): KitchenCommitRpcLine {
  return {
    product_id: args.line.catalogId,
    qty: args.reverseQty,
    variant_id: args.line.variantId ?? null,
    modifier_option_ids: (args.line.modifiers ?? [])
      .map((m) => m.optionId)
      .filter(Boolean),
    line_key: `L${args.lineIndex}`,
    line_fingerprint: args.lineFingerprint,
    line_index: args.lineIndex,
  };
}

export function deltaLinesToCartLines(deltas: CommitDeltaLine[]): CustomerVisitCartLine[] {
  return deltas.map((d) => ({
    ...d.line,
    quantity: d.deltaQty,
  }));
}

export function fulfillmentRpcLinesFromCart(
  lines: CustomerVisitCartLine[],
): Array<{
  product_id: string;
  qty: number;
  variant_id: string | null;
  line_key: string;
}> {
  return lines
    .filter((line) => !line.isCustomAmount && line.kind === "product" && line.trackStock)
    .map((line, idx) => ({
      product_id: line.catalogId,
      qty: line.quantity,
      variant_id: line.variantId ?? null,
      line_key: `L${idx + 1}`,
    }));
}
