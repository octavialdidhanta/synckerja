import {
  formatPosActivityReceiptNumber,
  normalizePosActivitySearchNeedle,
} from "./formatPosActivityReceiptNumber";
import type { PosActivityListRow } from "./posActivityTypes";

export function filterPosActivityRows(
  rows: PosActivityListRow[],
  search: string,
): PosActivityListRow[] {
  const raw = search.trim();
  if (!raw) return rows;
  const needle = raw.toLowerCase();
  const needleNorm = normalizePosActivitySearchNeedle(raw);

  return rows.filter((row) => {
    const receipt = formatPosActivityReceiptNumber(row.id).toLowerCase();
    const idNorm = row.id.replace(/-/g, "").toLowerCase();
    const name = (row.client_name ?? "").toLowerCase();
    const phone = (row.client_phone ?? "").toLowerCase();
    return (
      receipt.includes(needle) ||
      receipt.replace("sc-", "").includes(needleNorm) ||
      idNorm.includes(needleNorm) ||
      name.includes(needle) ||
      phone.includes(needle)
    );
  });
}
