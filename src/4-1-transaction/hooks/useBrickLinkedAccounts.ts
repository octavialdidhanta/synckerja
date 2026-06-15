import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';

export const BRICK_DISBURSE_BANKS = [
  { code: 'MANDIRI', label: 'Bank Mandiri' },
  { code: 'BRI', label: 'Bank BRI' },
  { code: 'BCA', label: 'Bank BCA' },
] as const;

export const BRICK_SANDBOX_DISBURSE_ACCOUNT = {
  bankShortCode: 'MANDIRI',
  accountNo: '12345678',
  accountHolderName: 'PROD ONLY',
} as const;

export function useBrickLinkedAccounts() {
  const { bankAccounts, loading } = useBankAccounts();
  const linkedAccounts = bankAccounts.filter(
    (a) => a.is_active && a.brick_link_status === 'linked',
  );
  const omnichannelSource =
    linkedAccounts.find((a) => a.use_for_omnichannel_income) ?? linkedAccounts[0] ?? null;

  return {
    loading,
    hasLinkedAccount: linkedAccounts.length > 0,
    linkedAccounts,
    omnichannelSource,
  };
}
