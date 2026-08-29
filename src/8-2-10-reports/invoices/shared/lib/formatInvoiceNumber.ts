export function formatInvoiceNumberFromActivityId(activityId: string): string {
  const hex = activityId.replace(/-/g, "").toUpperCase();
  return `INV-${hex.slice(0, 8)}`;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
