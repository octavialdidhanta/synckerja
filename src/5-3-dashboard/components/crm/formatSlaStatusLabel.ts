/** Stable RPC codes for SLA columns */
export type SlaStatusCode = 'pending' | 'on_time' | 'late' | 'na';

export function formatSlaStatusLabel(
  t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string,
  status: string | null | undefined,
  lateMinutes: number | null | undefined,
): string {
  const s = (status ?? '').trim().toLowerCase() as SlaStatusCode | '';
  if (s === 'on_time') return t('crm.sla.statusOnTime', 'On time');
  if (s === 'pending') return t('crm.sla.statusPending', 'Pending');
  if (s === 'na') return '—';
  if (s === 'late') {
    const m = lateMinutes != null && Number.isFinite(lateMinutes) ? Math.max(0, Math.round(Number(lateMinutes))) : null;
    if (m != null && m > 0) return t('crm.sla.statusLateMinutes', 'Late {{minutes}}m', { minutes: m });
    return t('crm.sla.statusLate', 'Late');
  }
  return '—';
}
