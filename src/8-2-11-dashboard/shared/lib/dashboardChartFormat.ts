export function formatDashboardMoneyTick(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Rp 0";
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
