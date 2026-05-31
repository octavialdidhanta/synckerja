const NPWP_MAX_DIGITS = 15;

export function stripNpwpDigits(value: string | undefined | null): string {
  return (value ?? '').replace(/\D/g, '').slice(0, NPWP_MAX_DIGITS);
}

/** Formats NPWP as 00.000.000.0-000.000 while typing or on load. */
export function formatNpwp(value: string | undefined | null): string {
  const digits = stripNpwpDigits(value);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12)}`;
}

export const NPWP_FORMATTED_MAX_LENGTH = 20;
export const NPWP_PLACEHOLDER = '00.000.000.0-000.000';
