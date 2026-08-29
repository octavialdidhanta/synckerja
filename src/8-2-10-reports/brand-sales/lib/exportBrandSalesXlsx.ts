import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { formatBrandItemDisplayName } from "./computeBrandSalesDisplay";
import type { BrandSalesItemRow } from "./brandSalesTypes";

function formatDeduction(amount: number): string {
  return formatReportsMoney(amount, { asDeduction: true });
}

export function exportBrandSalesByItemXlsx(args: {
  rows: BrandSalesItemRow[];
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const totals = args.rows.reduce(
    (acc, row) => ({
      qtySold: acc.qtySold + row.qtySold,
      qtyRefunded: acc.qtyRefunded + row.qtyRefunded,
      grossSales: acc.grossSales + row.grossSales,
      netSales: acc.netSales + row.netSales,
      discountAmount: acc.discountAmount + row.discountAmount,
      refundAmount: acc.refundAmount + row.refundAmount,
      cogs: acc.cogs + row.cogs,
      grossProfit: acc.grossProfit + row.grossProfit,
    }),
    {
      qtySold: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      cogs: 0,
      grossProfit: 0,
    },
  );

  const sheetRows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    [
      "Brand",
      "Item",
      "Variant",
      "SKU",
      "Items Sold",
      "Items Refunded",
      "Gross Sales",
      "Discount",
      "Refunds",
      "Net Sales",
      "Gross Profit",
    ],
    ...args.rows.map((row) => [
      row.brandName,
      row.itemName,
      row.variantName ?? "",
      row.sku ?? "",
      row.qtySold,
      row.qtyRefunded,
      formatReportsMoney(row.grossSales),
      formatDeduction(row.discountAmount),
      formatDeduction(row.refundAmount),
      formatReportsMoney(row.netSales),
      formatReportsMoney(row.grossProfit),
    ]),
    [],
    [
      "Grand Total",
      "",
      "",
      "",
      totals.qtySold,
      totals.qtyRefunded,
      formatReportsMoney(totals.grossSales),
      formatDeduction(totals.discountAmount),
      formatDeduction(totals.refundAmount),
      formatReportsMoney(totals.netSales),
      formatReportsMoney(totals.grossProfit),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetRows), "Brand Sales per Item");
  XLSX.writeFile(wb, `brand-sales-per-item-${args.fromYmd}_${args.toYmd}.xlsx`);
}

export function exportBrandSalesByOutletXlsx(args: {
  rows: Array<{
    brandName: string;
    outletName: string;
    qtySold: number;
    qtyRefunded: number;
    grossSales: number;
    discountAmount: number;
    refundAmount: number;
    netSales: number;
    grossProfit: number;
  }>;
  fromYmd: string;
  toYmd: string;
}): void {
  const totals = args.rows.reduce(
    (acc, row) => ({
      qtySold: acc.qtySold + row.qtySold,
      qtyRefunded: acc.qtyRefunded + row.qtyRefunded,
      grossSales: acc.grossSales + row.grossSales,
      netSales: acc.netSales + row.netSales,
      discountAmount: acc.discountAmount + row.discountAmount,
      refundAmount: acc.refundAmount + row.refundAmount,
      grossProfit: acc.grossProfit + row.grossProfit,
    }),
    {
      qtySold: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      grossProfit: 0,
    },
  );

  const sheetRows: Array<Array<string | number>> = [
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    ["Scope", "All outlets"],
    [],
    [
      "Brand",
      "Outlet",
      "Items Sold",
      "Items Refunded",
      "Gross Sales",
      "Discount",
      "Refunds",
      "Net Sales",
      "Gross Profit",
    ],
    ...args.rows.map((row) => [
      row.brandName,
      row.outletName,
      row.qtySold,
      row.qtyRefunded,
      formatReportsMoney(row.grossSales),
      formatDeduction(row.discountAmount),
      formatDeduction(row.refundAmount),
      formatReportsMoney(row.netSales),
      formatReportsMoney(row.grossProfit),
    ]),
    [],
    [
      "Grand Total",
      "",
      totals.qtySold,
      totals.qtyRefunded,
      formatReportsMoney(totals.grossSales),
      formatDeduction(totals.discountAmount),
      formatDeduction(totals.refundAmount),
      formatReportsMoney(totals.netSales),
      formatReportsMoney(totals.grossProfit),
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetRows), "Brand Sales per Outlet");
  XLSX.writeFile(wb, `brand-sales-per-outlet-${args.fromYmd}_${args.toYmd}.xlsx`);
}

// keep export helper aware of display name for consistency in tests
export { formatBrandItemDisplayName };
