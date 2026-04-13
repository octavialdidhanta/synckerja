/** Format ISO/subscription date strings for mobile + shared UI (replaces legacy `@/features/10-management/utils/dateUtils`). */
export function formatSubscriptionDate(
  input: string | null | undefined,
  options?: { month?: "long" | "short" | "numeric" },
): string {
  if (!input || typeof input !== "string") return "—";
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return "—";
  const month = options?.month ?? "long";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month,
    year: "numeric",
  });
}

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
