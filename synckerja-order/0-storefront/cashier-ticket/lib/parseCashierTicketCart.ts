import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export type CashierTicketLine = Pick<
  CustomerVisitCartLine,
  | "lineKey"
  | "catalogId"
  | "kind"
  | "serviceName"
  | "quantity"
  | "unitPrice"
  | "variantName"
  | "modifiers"
  | "kitchenNote"
>;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseModifiers(raw: unknown): CustomerVisitCartLine["modifiers"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as Record<string, unknown>;
      const name = asString(rec.name);
      if (!name) return null;
      return {
        optionId: asString(rec.optionId) || asString(rec.option_id) || name,
        name,
        extraPrice: asNumber(rec.extraPrice ?? rec.extra_price),
        quantity: Math.max(1, Math.round(asNumber(rec.quantity, 1))),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function parseLine(raw: unknown, index: number): CashierTicketLine | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const serviceName = asString(rec.serviceName ?? rec.service_name);
  if (!serviceName) return null;
  const catalogId = asString(rec.catalogId ?? rec.catalog_id) || `line-${index}`;
  const kindRaw = asString(rec.kind);
  const kind =
    kindRaw === "bundle" || kindRaw === "service" || kindRaw === "product" ? kindRaw : "product";
  const quantity = Math.max(1, Math.round(asNumber(rec.quantity, 1)));
  const unitPrice = Math.max(0, Math.round(asNumber(rec.unitPrice ?? rec.unit_price)));
  const lineKey = asString(rec.lineKey ?? rec.line_key) || `${catalogId}-${index}`;
  const kitchenNote = asString(rec.kitchenNote ?? rec.kitchen_note) || null;
  const variantName = asString(rec.variantName ?? rec.variant_name) || null;

  return {
    lineKey,
    catalogId,
    kind,
    serviceName,
    quantity,
    unitPrice,
    variantName,
    modifiers: parseModifiers(rec.modifiers),
    kitchenNote,
  };
}

export function parseCashierTicketCart(raw: unknown): CashierTicketLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, index) => parseLine(row, index))
    .filter((line): line is CashierTicketLine => Boolean(line));
}
