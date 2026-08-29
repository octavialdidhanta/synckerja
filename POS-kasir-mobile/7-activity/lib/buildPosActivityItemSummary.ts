import type { PosActivityItem } from "./posActivityTypes";

/** Build one-line item summary for Activity list rows. */
export function buildPosActivityItemSummary(
  items: Array<Pick<PosActivityItem, "service_name" | "sub_service_name">>,
  maxNames = 3,
): string {
  const names = items
    .map((item) => (item.service_name ?? "").trim())
    .filter(Boolean);

  if (names.length === 0) return "";
  const shown = names.slice(0, maxNames);
  const extra = names.length - shown.length;
  const base = shown.join(", ");
  return extra > 0 ? `${base}…` : base;
}
