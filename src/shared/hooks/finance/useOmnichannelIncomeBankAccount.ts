import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export type OmnichannelIncomeBankAccount = {
  id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  account_holder: string | null;
};

export function formatOmnichannelBankLabel(account: OmnichannelIncomeBankAccount): string {
  const parts = [account.name];
  if (account.bank_name?.trim()) parts.push(account.bank_name.trim());
  if (account.account_number?.trim()) parts.push(account.account_number.trim());
  return parts.join(' · ');
}

export type OmnichannelBankCopyLabels = {
  header: string;
  /** Prefix for the bank line, e.g. "Bank:" */
  bankLinePrefix: string;
  /** Between account number and holder, e.g. "a.n" (ID) or "a/c" (EN). */
  onBehalf: string;
};

/**
 * Compact two-line text for sharing with customers, e.g.:
 * Payment transfer details:
 * Bank: MANDIRI 118-00-1475242-1 a.n PT. EXAMPLE
 */
export function formatOmnichannelBankCopyText(
  account: OmnichannelIncomeBankAccount,
  labels: OmnichannelBankCopyLabels,
): string {
  const bank = account.bank_name?.trim() ?? '';
  const number = account.account_number?.trim() ?? '';
  const holder = account.account_holder?.trim() ?? '';

  const bankAndNumber = [bank, number].filter(Boolean).join(' ');
  if (!bankAndNumber) return labels.header;

  let detailLine = `${labels.bankLinePrefix} ${bankAndNumber}`;
  if (holder) {
    detailLine += ` ${labels.onBehalf} ${holder}`;
  }

  return `${labels.header}\n${detailLine}`;
}

export const useOmnichannelIncomeBankAccount = () => {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: ['omnichannel-income-bank-account', organizationId],
    queryFn: async (): Promise<OmnichannelIncomeBankAccount | null> => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, name, account_number, bank_name, account_holder')
        .eq('organization_id', organizationId)
        .eq('use_for_omnichannel_income', true)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching omnichannel income bank account:', error);
        throw error;
      }

      return data as OmnichannelIncomeBankAccount | null;
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  return {
    omnichannelBank: query.data ?? null,
    loading: query.isLoading,
    isPending: query.isPending,
    refetch: query.refetch,
  };
};
