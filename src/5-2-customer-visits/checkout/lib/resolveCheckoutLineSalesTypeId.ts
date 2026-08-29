import type { CustomerVisitCartLine } from "./customerVisitCheckout.types";

export type ResolveCheckoutLineSalesTypeArgs = {
  line: Pick<CustomerVisitCartLine, "lineSalesTypeId">;
  billSalesTypeId?: string | null;
  /** Future: map channel slug (gofood, online-order) to catalog_sales_type_id */
  channelSalesTypeId?: string | null;
};

/**
 * Resolves persisted line sales type: customize line > channel integration > bill header.
 */
export function resolveCheckoutLineSalesTypeId(
  args: ResolveCheckoutLineSalesTypeArgs,
): string | null {
  const lineType = args.line.lineSalesTypeId?.trim() || null;
  if (lineType) return lineType;
  const channelType = args.channelSalesTypeId?.trim() || null;
  if (channelType) return channelType;
  return args.billSalesTypeId?.trim() || null;
}
