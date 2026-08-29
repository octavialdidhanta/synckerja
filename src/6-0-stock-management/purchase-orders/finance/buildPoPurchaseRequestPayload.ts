export type PoPurchaseRequestLineInput = {
  nameSnapshot: string;
  qty: number;
  unitCost: number;
};

function formatPoQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  const trimmed = String(qty).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  return trimmed;
}

function formatPoIdr(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  return `Rp ${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export function buildPoPurchaseRequestTitle(orderNumber: string, outletName: string): string {
  return `PO ${orderNumber} — ${outletName.trim() || "Outlet"}`;
}

export function buildPoPurchaseRequestDescription(args: {
  note: string | null | undefined;
  outletName: string;
  lines: PoPurchaseRequestLineInput[];
}): string {
  const lineText = args.lines
    .filter((line) => Number.isFinite(line.qty) && line.qty > 0)
    .map(
      (line) =>
        `${line.nameSnapshot.trim() || "—"} × ${formatPoQty(line.qty)} @ ${formatPoIdr(line.unitCost)}`,
    )
    .join("\n");

  return [args.note?.trim() || null, `Outlet: ${args.outletName.trim() || "—"}`, lineText || "—"]
    .filter(Boolean)
    .join("\n\n");
}

export { formatPoQty, formatPoIdr };
