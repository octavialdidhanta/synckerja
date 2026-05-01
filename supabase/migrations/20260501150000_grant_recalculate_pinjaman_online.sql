-- Allow clients to refresh Pinjaman Online debt totals after recording debt_payments (paid_amount).
GRANT EXECUTE ON FUNCTION public.recalculate_pinjaman_online_debt_amount (uuid) TO authenticated;
