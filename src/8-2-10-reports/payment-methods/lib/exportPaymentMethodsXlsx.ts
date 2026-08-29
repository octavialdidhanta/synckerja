import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { PaymentMethodsDisplay } from "./paymentMethodsTypes";

export function exportPaymentMethodsXlsx(args: {
  display: PaymentMethodsDisplay;
  categoryLabel: (category: string) => string;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
}): void {
  const summaryRows: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    [],
    ["Category", "Transaction Count", "Total Collected"],
  ];

  for (const cat of args.display.categories) {
    summaryRows.push([
      args.categoryLabel(cat.category),
      cat.transactionCount,
      formatReportsMoney(cat.totalCollected),
    ]);
  }
  summaryRows.push(
    [],
    [
      "Grand Total",
      args.display.grandTotal.transactionCount,
      formatReportsMoney(args.display.grandTotal.totalCollected),
    ],
  );

  const detailRows: Array<Array<string | number>> = [
    ["Category", "Payment Method", "Transaction Count", "Total Collected"],
    ...args.display.categories.flatMap((cat) =>
      cat.channels.map((ch) => [
        args.categoryLabel(cat.category),
        ch.channelName,
        ch.transactionCount,
        formatReportsMoney(ch.totalCollected),
      ]),
    ),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "By Category");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "By Channel");
  XLSX.writeFile(wb, `payment-methods-${args.fromYmd}_${args.toYmd}.xlsx`);
}
