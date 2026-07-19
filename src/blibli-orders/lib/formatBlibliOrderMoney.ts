export function formatBlibliOrderMoney(
  amount: number | null | undefined,
  locale = 'id-ID',
  currency = 'IDR',
): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `Rp${Math.round(n).toLocaleString('id-ID')}`;
  }
}

export function formatBlibliEpoch(
  epochMs: number | null | undefined,
  locale = 'id-ID',
): string {
  if (epochMs == null || !Number.isFinite(Number(epochMs))) return '—';
  const d = new Date(Number(epochMs));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
