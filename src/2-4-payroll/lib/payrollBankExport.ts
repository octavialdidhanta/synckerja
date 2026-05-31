export interface PayrollBankExportRow {
  employeeCode: string;
  employeeName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  paymentReference: string;
  payDate: string;
}

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildPayrollBankCsv(rows: PayrollBankExportRow[]): string {
  const header = [
    "No",
    "Employee ID",
    "Employee Name",
    "Bank Name",
    "Account Number",
    "Account Holder",
    "Amount (THP)",
    "Payment Reference",
    "Pay Date",
  ];
  const lines = [header.join(",")];
  rows.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        escapeCsv(row.employeeCode),
        escapeCsv(row.employeeName),
        escapeCsv(row.bankName),
        escapeCsv(row.accountNumber),
        escapeCsv(row.accountHolder),
        row.amount,
        escapeCsv(row.paymentReference),
        escapeCsv(row.payDate),
      ].join(","),
    );
  });
  return lines.join("\n");
}

export function downloadPayrollBankCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
