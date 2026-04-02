/** User-facing message when PostgREST cannot see payroll tables (migration not applied / schema cache). */
export function formatPayrollDataError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (
    /schema cache|PGRST205|404/i.test(raw) ||
    /could not find the table/i.test(raw)
  ) {
    return "Payroll tables are not in the database yet. Apply Supabase migrations for payroll, then reload.";
  }
  return raw;
}
