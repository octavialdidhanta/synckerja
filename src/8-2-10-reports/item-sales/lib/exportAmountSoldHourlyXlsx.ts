import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { formatItemDisplayName } from "./computeItemSalesDisplay";
import type { ItemSalesHourlyDisplay, ItemSalesRow } from "./itemSalesTypes";

function buildItemLabelMap(rows: ItemSalesRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const key = row.catalogBundleId
      ? `b:${row.catalogBundleId}`
      : `p:${row.catalogProductId ?? ""}:v:${row.catalogVariantId ?? ""}`;
    if (!map.has(key)) {
      map.set(key, formatItemDisplayName(row));
    }
  }
  return map;
}

export function exportAmountSoldHourlyXlsx(args: {
  hourly: ItemSalesHourlyDisplay;
  summaryRows: ItemSalesRow[];
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const labelMap = buildItemLabelMap(args.summaryRows);
  const itemKeys =
    args.hourly.itemKeys.length > 0
      ? args.hourly.itemKeys
      : [...new Set(args.hourly.rows.map((r) => r.productKey))];

  const header = ["Item", ...args.hourly.hours.map((h) => `${String(h).padStart(2, "0")}:00`)];

  const matrix = itemKeys.map((key) => {
    const sample = args.hourly.rows.find((r) => r.productKey === key);
    const label =
      labelMap.get(key) ??
      (sample
        ? sample.variantName
          ? `${sample.itemName} - ${sample.variantName}`
          : sample.itemName
        : key);
    const hourCells = args.hourly.hours.map((hour) => {
      const cell = args.hourly.rows.find((r) => r.productKey === key && r.hour === hour);
      return cell ? formatReportsMoney(cell.netSales) : formatReportsMoney(0);
    });
    return [label, ...hourCells];
  });

  const rows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    ["Report", "Amount Sold Hourly (WIB)"],
    [],
    header,
    ...matrix,
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Amount Sold Hourly");
  XLSX.writeFile(wb, `amount-sold-hourly-${args.fromYmd}_${args.toYmd}.xlsx`);
}
