export function formatIDR(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export function getMonthlyPriceForMembers(basePrice: number, memberCount: number): number {
  const base = Number(basePrice);
  const count = Number(memberCount);
  return (Number.isFinite(base) ? base : 0) * (Number.isFinite(count) ? count : 0);
}

export function getYearlyPriceForMembers(
  basePrice: number,
  memberCount: number,
  annualDiscountPercent?: number | null,
): number {
  const base = Number(basePrice);
  const count = Number(memberCount);
  const discount =
    annualDiscountPercent != null && Number.isFinite(Number(annualDiscountPercent))
      ? Number(annualDiscountPercent)
      : 20;
  const product = (Number.isFinite(base) ? base : 0) * (Number.isFinite(count) ? count : 0) * 12;
  return product * (1 - discount / 100);
}
