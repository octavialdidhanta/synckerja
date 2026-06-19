/** Format bank mutation timestamp in WIB (Asia/Jakarta). */
export function formatMutationDateTime(
  iso: string | null | undefined,
  locale = 'id-ID',
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Prefer paid_at from purchase request, then statement line transaction_date. */
export function resolveMutationDisplayDate(row: {
  transaction_date: string;
  expense?: {
    purchase_request?: { paid_at?: string | null } | null;
  } | null;
}): string {
  const paidAt = row.expense?.purchase_request?.paid_at;
  return paidAt ?? row.transaction_date;
}
