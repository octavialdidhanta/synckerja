import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  salesTypeBadgeInitials,
  stripSalesTypeFromSubServiceName,
} from "./salesTypeBadgeInitials";
import type {
  PosActivityDetail,
  PosActivityItem,
  PosActivityProductGroup,
  PosActivityProductLine,
  PosActivityProductSubLine,
} from "./posActivityTypes";

export type SalesTypeNameMap = Map<string, string>;

function resolveSalesTypeName(
  id: string | null | undefined,
  label: string | null | undefined,
  nameById: SalesTypeNameMap,
  unknownLabel: string,
): { id: string | null; name: string } {
  const trimmedLabel = (label ?? "").trim();
  if (id && nameById.has(id)) {
    return { id, name: nameById.get(id) || trimmedLabel || unknownLabel };
  }
  if (trimmedLabel) return { id: id ?? null, name: trimmedLabel };
  if (id) return { id, name: unknownLabel };
  return { id: null, name: unknownLabel };
}

function cartLineToProductLine(
  line: CustomerVisitCartLine,
  groupName: string,
): PosActivityProductLine {
  const title = (line.serviceName ?? "").trim() || "—";
  const variant = (line.variantName ?? "").trim();
  const subFromCatalog = stripSalesTypeFromSubServiceName(
    line.subServiceName,
    groupName,
  );
  const subtitle = variant || subFromCatalog || null;

  const children: PosActivityProductSubLine[] = [];
  for (const m of line.modifiers ?? []) {
    const name = (m.name ?? "").trim();
    if (!name) continue;
    children.push({
      key: `${line.lineKey}-mod-${m.optionId}`,
      label: name,
      amountRp: Math.round(Number(m.extraPrice) || 0),
      kind: "modifier",
    });
  }
  if (line.lineDiscount) {
    const name = (line.lineDiscount.name ?? "").trim() || "Discount";
    children.push({
      key: `${line.lineKey}-disc-${line.lineDiscount.id}`,
      label: name,
      amountRp: Math.round(Number(line.lineDiscount.amountRp) || 0),
      kind: "discount",
    });
  }

  return {
    key: line.lineKey,
    title,
    subtitle,
    quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
    amountRp: Math.round(lineTotal(line)),
    children,
  };
}

function activityItemToProductLine(
  item: PosActivityItem,
  groupName: string,
): PosActivityProductLine {
  const title = (item.service_name ?? "").trim() || "—";
  const subtitle =
    stripSalesTypeFromSubServiceName(item.sub_service_name, groupName) || null;
  return {
    key: item.id,
    title,
    subtitle,
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    amountRp: Math.round(Number(item.total_price) || 0),
    children: [],
  };
}

function pushIntoGroups(
  groups: Map<string, PosActivityProductGroup>,
  salesTypeId: string | null,
  salesTypeName: string,
  line: PosActivityProductLine,
): void {
  const key = salesTypeId ?? `name:${salesTypeName.toLowerCase()}`;
  const existing = groups.get(key);
  if (existing) {
    existing.lines.push(line);
    return;
  }
  groups.set(key, {
    key,
    salesTypeId,
    salesTypeName,
    badge: salesTypeBadgeInitials(salesTypeName),
    lines: [line],
  });
}

/**
 * Build PRODUK groups for Activity detail.
 * Prefer cart_snapshot per-line sales types; else single bill-level group.
 */
export function groupPosActivityProductsBySalesType(args: {
  detail: Pick<PosActivityDetail, "catalog_sales_type_id" | "items">;
  cartSnapshot: CustomerVisitCartLine[] | null | undefined;
  salesTypeNameById: SalesTypeNameMap;
  unknownSalesTypeLabel: string;
}): PosActivityProductGroup[] {
  const {
    detail,
    cartSnapshot,
    salesTypeNameById,
    unknownSalesTypeLabel,
  } = args;

  const billResolved = resolveSalesTypeName(
    detail.catalog_sales_type_id,
    null,
    salesTypeNameById,
    unknownSalesTypeLabel,
  );

  const groups = new Map<string, PosActivityProductGroup>();
  const cartLines = (cartSnapshot ?? []).filter(
    (line) => !line.isCustomAmount && Math.round(Number(line.quantity) || 0) > 0,
  );

  if (cartLines.length > 0) {
    for (const cartLine of cartLines) {
      const resolved = resolveSalesTypeName(
        cartLine.lineSalesTypeId ?? detail.catalog_sales_type_id,
        cartLine.lineSalesTypeLabel,
        salesTypeNameById,
        billResolved.name,
      );
      pushIntoGroups(
        groups,
        resolved.id,
        resolved.name,
        cartLineToProductLine(cartLine, resolved.name),
      );
    }
    return [...groups.values()];
  }

  const groupName = billResolved.name;
  for (const item of detail.items) {
    pushIntoGroups(
      groups,
      billResolved.id,
      groupName,
      activityItemToProductLine(item, groupName),
    );
  }
  return [...groups.values()];
}
