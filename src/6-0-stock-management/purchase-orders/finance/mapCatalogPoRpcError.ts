import { matchInventoryRpcError } from "@/8-2-5-inventory-settings/lib/mapInventoryRpcError";

const RPC_MESSAGES: Record<string, string> = {
  catalog_po_create_and_fulfill_disabled:
    "Create & Fulfill is disabled. Create the PO, then fulfill after payment.",
  catalog_po_create_and_fulfill_required:
    "Simple PO mode requires immediate fulfillment on create.",
  catalog_po_payment_required: "Fulfillment is available after this PO is approved and paid.",
  catalog_po_already_paid: "This purchase order is already paid and cannot be changed.",
  catalog_po_already_approved: "Approved purchase orders cannot be edited. Cancel payment first is not allowed.",
  catalog_po_not_rejected: "Only rejected purchase orders can be resubmitted.",
  catalog_po_not_waiting: "Only waiting purchase orders can be updated.",
  catalog_po_not_found: "Purchase order not found.",
  catalog_po_forbidden: "You do not have access to this purchase order.",
};

export function mapCatalogPoRpcError(error: unknown, fallback: string): string {
  const inventoryMessage = matchInventoryRpcError(error);
  if (inventoryMessage) return inventoryMessage;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const [code, message] of Object.entries(RPC_MESSAGES)) {
    if (raw.includes(code)) return message;
  }
  return raw.trim() || fallback;
}
