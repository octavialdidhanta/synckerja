export type PaidSalesActivityRow = {
  total_amount?: number | null;
  total_paid_amount?: number | null;
  payment_status?: string | null;
  is_paid?: boolean | null;
};

export function isPaidSalesActivity(row: PaidSalesActivityRow): boolean {
  const total = Number(row.total_amount);
  if (!Number.isFinite(total) || total <= 0) return false;
  if (String(row.payment_status ?? '').toLowerCase() === 'paid') return true;
  const paid = Number(row.total_paid_amount);
  return row.is_paid === true && Number.isFinite(paid) && paid >= total;
}
