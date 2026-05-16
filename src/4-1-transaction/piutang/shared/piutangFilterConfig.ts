import type { PiutangFilterMode, PiutangVerificationFilterMode } from '../types/piutang.types';

export const PIUTANG_DEFAULT_STATUS: PiutangFilterMode = 'open';
export const PIUTANG_DEFAULT_VERIFICATION: PiutangVerificationFilterMode = 'all';

export type PiutangFilterOption<T extends string> = {
  value: T;
  label: string;
};

export const PIUTANG_STATUS_FILTER_OPTIONS: readonly PiutangFilterOption<PiutangFilterMode>[] = [
  { value: 'open', label: 'Terbuka (sisa / perlu verifikasi)' },
  { value: 'settled', label: 'Lunas' },
  { value: 'all', label: 'Semua' },
] as const;

export const PIUTANG_VERIFICATION_FILTER_OPTIONS: readonly PiutangFilterOption<PiutangVerificationFilterMode>[] =
  [
    { value: 'all', label: 'Verifikasi: semua' },
    { value: 'unchecked', label: 'Belum dicek' },
    { value: 'approved', label: 'OK' },
    { value: 'rejected', label: 'Ditolak' },
  ] as const;

export function getPiutangStatusFilterLabel(value: PiutangFilterMode): string {
  return PIUTANG_STATUS_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getPiutangVerificationFilterLabel(value: PiutangVerificationFilterMode): string {
  return PIUTANG_VERIFICATION_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function hasActivePiutangFilters(params: {
  search: string;
  status: PiutangFilterMode;
  verification: PiutangVerificationFilterMode;
}): boolean {
  return (
    Boolean(params.search.trim()) ||
    params.status !== PIUTANG_DEFAULT_STATUS ||
    params.verification !== PIUTANG_DEFAULT_VERIFICATION
  );
}
