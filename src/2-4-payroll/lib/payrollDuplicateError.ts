type PayrollWriteError = {
  code?: string;
  message?: string;
} | null;

export function payrollDuplicateMessage(
  error: PayrollWriteError,
  kind: "period" | "run",
): string | null {
  if (error?.code !== "23505") return null;
  if (kind === "period") {
    return "Periode dengan tanggal yang sama sudah ada. Pakai periode itu, atau centang Bonus/THR jika slip-nya terpisah.";
  }
  return "Periode ini sudah punya payroll run. Buka run yang ada.";
}
