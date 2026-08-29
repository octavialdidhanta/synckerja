import * as XLSX from "xlsx";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import { formatShiftDifference } from "./formatShiftDifference";
import type { ShiftRow } from "./shiftTypes";

function formatShiftDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date} ${time}`;
  } catch {
    return iso;
  }
}

export function exportShiftXlsx(args: {
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
  staffLabel: string;
  rows: ShiftRow[];
}): void {
  const meta: Array<Array<string | number>> = [
    ["Outlet", args.outletLabel],
    ["Period", `${args.fromYmd} – ${args.toYmd}`],
    ["Staff", args.staffLabel],
    [],
  ];

  const sheetRows: Array<Array<string | number>> = [
    ...meta,
    [
      "Outlet",
      "Start Time",
      "End Time",
      "Access",
      "Opening Cash",
      "Total Expected",
      "Total Actual",
      "Difference",
      "Status",
    ],
    ...args.rows.map((row) => [
      row.outletName,
      formatShiftDateTime(row.openedAt),
      row.closedAt ? formatShiftDateTime(row.closedAt) : "—",
      row.openedByName,
      formatReportsMoney(row.openingCash),
      formatReportsMoney(row.expectedCash),
      row.closingCash != null ? formatReportsMoney(row.closingCash) : "—",
      formatShiftDifference(row.cashDifference),
      row.status,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, "Shift");
  XLSX.writeFile(wb, `shift-report-${args.fromYmd}-${args.toYmd}.xlsx`);
}
