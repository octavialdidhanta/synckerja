export type LeadMagnetMetricFormat = 'count' | 'currency';

export function formatLeadMagnetMetricValue(
  value: number,
  format: LeadMagnetMetricFormat = 'count',
): string {
  const n = Number.isFinite(value) ? value : 0;
  if (format === 'currency') {
    return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
  }
  return n.toLocaleString('id-ID');
}
