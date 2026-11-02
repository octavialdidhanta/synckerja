export function canOpenAiEmployeePage(
  employee: { is_ai?: boolean | null },
  role?: string | null,
): boolean {
  const value = (role ?? "").trim().toLowerCase();
  return Boolean(employee.is_ai) && (value === "owner" || value === "admin");
}
