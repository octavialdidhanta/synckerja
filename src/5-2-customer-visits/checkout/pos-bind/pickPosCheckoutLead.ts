import { isGenericCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { isAttributedPosCheckoutLead } from "./posCheckoutLeadGuards";
import type { PosCheckoutLeadRow } from "./posCheckoutLead.types";

function timestampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function personalRank(client: string | null | undefined): number {
  return isGenericCustomerName(client) ? 0 : 1;
}

export function pickPosCheckoutLead(
  leads: PosCheckoutLeadRow[],
  enrolledLeadIds: ReadonlySet<string> = new Set(),
): PosCheckoutLeadRow | null {
  if (leads.length === 0) return null;
  const ranked = [...leads].sort((a, b) => {
    const attrA = isAttributedPosCheckoutLead(a, enrolledLeadIds) ? 1 : 0;
    const attrB = isAttributedPosCheckoutLead(b, enrolledLeadIds) ? 1 : 0;
    if (attrA !== attrB) return attrB - attrA;
    const persA = personalRank(a.client);
    const persB = personalRank(b.client);
    if (persA !== persB) return persB - persA;
    const tA = timestampMs(a.updated_at) || timestampMs(a.created_at);
    const tB = timestampMs(b.updated_at) || timestampMs(b.created_at);
    return tB - tA;
  });
  return ranked[0] ?? null;
}
