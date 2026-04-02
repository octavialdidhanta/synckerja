/** Thousand-formatted IDR input helpers (from reference pricingUtils). */
export function formatInputNumber(value: number | string): string {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return '';
    const roundedValue = Math.round(value);
    return roundedValue.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  const numericValue = value.replace(/[^\d]/g, '');
  if (!numericValue) return '';

  const numValue = parseFloat(numericValue);
  if (isNaN(numValue) || !isFinite(numValue)) return '';

  const roundedValue = Math.round(numValue);
  return roundedValue.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function parseInputNumber(value: string): number {
  if (!value) return 0;
  const numericValue = value.replace(/[^\d]/g, '');
  if (!numericValue) return 0;
  const numValue = parseFloat(numericValue);
  return isNaN(numValue) ? 0 : Math.round(numValue);
}
