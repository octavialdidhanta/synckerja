import { encodeEscPosText, escPosDivider } from "./encodeEscPosText";
import { catalogItemLabel } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export type PosOrderTicketLine = CustomerVisitCartLine & {
  productCategoryId?: string | null;
};

export type PosOrderTicketPrintInput = {
  outletName: string;
  lines: PosOrderTicketLine[];
  customerName?: string | null;
  /** When true, emit one ticket document per unit qty. */
  perProduct: boolean;
};

function filterLines(
  lines: PosOrderTicketLine[],
  categoryIds: string[] | "all",
): PosOrderTicketLine[] {
  if (categoryIds === "all") return lines;
  const set = new Set(categoryIds);
  return lines.filter((line) => {
    if (!line.productCategoryId) return true;
    return set.has(line.productCategoryId);
  });
}

function buildCombinedTicket(
  outletName: string,
  lines: PosOrderTicketLine[],
  customerName?: string | null,
): Uint8Array {
  const width = 32;
  const rows: string[] = [];
  rows.push("TIKET PESANAN");
  rows.push(outletName.slice(0, width));
  rows.push(escPosDivider(width));
  if (customerName) rows.push(customerName.slice(0, width));
  rows.push(new Date().toLocaleString("id-ID").slice(0, width));
  rows.push(escPosDivider(width));
  for (const line of lines) {
    rows.push(`${line.quantity}x ${catalogItemLabel(line)}`.slice(0, width));
  }
  rows.push(escPosDivider(width));
  return encodeEscPosText(rows, { width });
}

function buildSingleItemTicket(
  outletName: string,
  line: PosOrderTicketLine,
  unitIndex: number,
  unitTotal: number,
  customerName?: string | null,
): Uint8Array {
  const width = 32;
  const rows: string[] = [];
  rows.push("TIKET PESANAN");
  rows.push(outletName.slice(0, width));
  rows.push(escPosDivider(width));
  if (customerName) rows.push(customerName.slice(0, width));
  rows.push(`${unitIndex}/${unitTotal}`);
  rows.push(`1x ${catalogItemLabel(line)}`.slice(0, width));
  rows.push(escPosDivider(width));
  return encodeEscPosText(rows, { width });
}

/** Returns one or more ESC/POS payloads (already duplicated by copies at service layer). */
export function buildOrderTicketEscPosPayloads(
  input: PosOrderTicketPrintInput,
  categoryIds: string[] | "all",
): Uint8Array[] {
  const lines = filterLines(input.lines, categoryIds);
  if (lines.length === 0) return [];

  if (!input.perProduct) {
    return [buildCombinedTicket(input.outletName, lines, input.customerName)];
  }

  const payloads: Uint8Array[] = [];
  for (const line of lines) {
    const qty = Math.max(1, Math.floor(line.quantity));
    for (let i = 1; i <= qty; i++) {
      payloads.push(
        buildSingleItemTicket(input.outletName, line, i, qty, input.customerName),
      );
    }
  }
  return payloads;
}
