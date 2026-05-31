import type { AppLanguage } from '@/shared/i18n/translations';
import type { ProfilePayrollInfoData } from '@/mobile/1-profile/hooks/useProfilePayrollInfo';
import { hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';
import { formatSingleDate } from '@/mobile/1-profile/utils/educationExperienceDisplayUtils';

type TranslateFn = (key: string, fallback?: string) => string;

export function formatBpjsKesehatanConfiguration(
  value: string | undefined,
  t: TranslateFn,
): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  const keyMap: Record<string, string> = {
    by_company: 'profile.payrollInfo.bpjsConfig.byCompany',
    by_employee: 'profile.payrollInfo.bpjsConfig.byEmployee',
    shared: 'profile.payrollInfo.bpjsConfig.shared',
  };
  const key = keyMap[normalized];
  if (key) {
    const fallbacks: Record<string, string> = {
      by_company: 'By Company',
      by_employee: 'By Employee',
      shared: 'Shared',
    };
    return t(key, fallbacks[normalized]);
  }
  return value.trim();
}

export function formatPayrollAmount(
  amount: number | undefined,
  currency: string | undefined,
  language: AppLanguage,
): string | undefined {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return undefined;

  const currencyCode = currency?.trim() || 'IDR';
  const locale = language === 'id' ? 'id-ID' : 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString(locale)}`;
  }
}

function formatFamilyMembersCount(value: number | undefined): string | undefined {
  if (value === undefined || value === null || Number.isNaN(value)) return undefined;
  return String(value);
}

export function buildBpjsFields(
  payroll: ProfilePayrollInfoData,
  t: TranslateFn,
  language: AppLanguage,
) {
  return [
    {
      label: t('profile.payrollInfo.bpjsKetenagakerjaanNumberLabel', 'BPJS Ketenagakerjaan Number'),
      value: payroll.bpjs_ketenagakerjaan_number,
    },
    {
      label: t('profile.payrollInfo.bpjsKesehatanNumberLabel', 'BPJS Kesehatan Number'),
      value: payroll.bpjs_kesehatan_number,
    },
    {
      label: t('profile.payrollInfo.bpjsKesehatanFamilyLabel', 'BPJS Kesehatan Family Members'),
      value: formatFamilyMembersCount(payroll.bpjs_kesehatan_family_members),
    },
    {
      label: t('profile.payrollInfo.bpjsKetenagakerjaanDateLabel', 'BPJS Ketenagakerjaan Date'),
      value: formatSingleDate(payroll.bpjs_ketenagakerjaan_date, language),
    },
    {
      label: t('profile.payrollInfo.bpjsKesehatanDateLabel', 'BPJS Kesehatan Date'),
      value: formatSingleDate(payroll.bpjs_kesehatan_date, language),
    },
    {
      label: t('profile.payrollInfo.bpjsKesehatanConfigurationLabel', 'BPJS Kesehatan Configuration'),
      value: formatBpjsKesehatanConfiguration(payroll.bpjs_kesehatan_configuration, t),
    },
  ];
}

export function buildBankingFields(payroll: ProfilePayrollInfoData, t: TranslateFn) {
  return [
    { label: t('profile.payrollInfo.npwpLabel', 'NPWP'), value: payroll.npwp },
    { label: t('profile.payrollInfo.bankNameLabel', 'Bank Name'), value: payroll.bank_name },
    {
      label: t('profile.payrollInfo.bankAccountNumberLabel', 'Account Number'),
      value: payroll.bank_account_number,
    },
    {
      label: t('profile.payrollInfo.bankAccountHolderLabel', 'Account Holder Name'),
      value: payroll.bank_account_holder,
    },
    { label: t('profile.payrollInfo.currencyLabel', 'Currency'), value: payroll.currency },
  ];
}

export function buildTaxFields(
  payroll: ProfilePayrollInfoData,
  t: TranslateFn,
  language: AppLanguage,
) {
  return [
    {
      label: t('profile.payrollInfo.ptkpStatusLabel', 'PTKP Status'),
      value: payroll.ptkp_status,
    },
    {
      label: t('profile.payrollInfo.beginningNettoLabel', 'Beginning Netto'),
      value: formatPayrollAmount(payroll.beginning_netto, payroll.currency, language),
    },
    {
      label: t('profile.payrollInfo.pph21PaidLabel', 'PPH21 Paid'),
      value: formatPayrollAmount(payroll.pph21_paid, payroll.currency, language),
    },
  ];
}

export function filterPayrollFields(fields: { label: string; value: string | undefined }[]) {
  return fields.filter((field) => hasDisplayValue(field.value));
}

export function hasAnyPayrollDisplayData(payroll: ProfilePayrollInfoData | null): boolean {
  if (!payroll) return false;

  const allFields = [
    ...buildBpjsFields(payroll, () => '', 'id'),
    ...buildBankingFields(payroll, () => ''),
    ...buildTaxFields(payroll, () => '', 'id'),
  ];

  return allFields.some((field) => hasDisplayValue(field.value));
}
