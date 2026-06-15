import type { PiutangFilterMode, PiutangVerificationFilterMode } from '../types/piutang.types';

export const PIUTANG_DEFAULT_STATUS: PiutangFilterMode = 'open';
export const PIUTANG_DEFAULT_VERIFICATION: PiutangVerificationFilterMode = 'all';

export type PiutangFilterOption<T extends string> = {
  value: T;
  labelKey: string;
  label: string;
};

export const PIUTANG_STATUS_FILTER_OPTIONS: readonly PiutangFilterOption<PiutangFilterMode>[] = [
  {
    value: 'open',
    labelKey: 'incomes.piutang.filters.statusOpen',
    label: 'Terbuka (sisa / perlu verifikasi)',
  },
  { value: 'settled', labelKey: 'incomes.piutang.filters.statusSettled', label: 'Lunas' },
  { value: 'all', labelKey: 'incomes.piutang.filters.statusAll', label: 'Semua' },
] as const;

export const PIUTANG_VERIFICATION_FILTER_OPTIONS: readonly PiutangFilterOption<PiutangVerificationFilterMode>[] =
  [
    { value: 'all', labelKey: 'incomes.piutang.filters.verificationAll', label: 'Verifikasi: semua' },
    {
      value: 'unchecked',
      labelKey: 'incomes.piutang.filters.verificationUnchecked',
      label: 'Belum dicek',
    },
    { value: 'approved', labelKey: 'incomes.piutang.filters.verificationApproved', label: 'OK' },
    { value: 'rejected', labelKey: 'incomes.piutang.filters.verificationRejected', label: 'Ditolak' },
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
