import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

export interface BankAccount {
  id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  account_holder: string | null;
  organization_id: string;
  is_active: boolean;
  use_for_omnichannel_income: boolean;
  use_for_gateway_payout: boolean;
  gateway_payout_bank_code: string | null;
  gateway_payout_validation_status?: string | null;
  gateway_payout_validation_error?: string | null;
  brick_account_id: string | null;
  brick_connection_id: string | null;
  brick_aggregated_account_id: string | null;
  brick_link_mode: string;
  brick_link_status: 'unlinked' | 'pending' | 'linked' | 'error';
  brick_last_sync_at: string | null;
  brick_last_sync_error: string | null;
  bank_statement_balance: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateBankAccountData {
  name: string;
  account_number?: string;
  bank_name?: string;
  account_holder?: string;
}

export interface UpdateBankAccountData {
  name?: string;
  account_number?: string;
  bank_name?: string;
  account_holder?: string;
  is_active?: boolean;
  use_for_omnichannel_income?: boolean;
  use_for_gateway_payout?: boolean;
  gateway_payout_bank_code?: string;
}

export type UseBankAccountsOptions = {
  includeInactive?: boolean;
};

export const useBankAccounts = (options?: UseBankAccountsOptions) => {
  const includeInactive = options?.includeInactive === true;
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bankAccounts = [], isLoading: loading, isPending, refetch } = useQuery({
    queryKey: ['bank-accounts', organizationId, includeInactive],
    queryFn: async () => {
      if (!organizationId) return [];

      let q = supabase
        .from('bank_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (!includeInactive) {
        q = q.eq('is_active', true);
      }

      const { data, error } = await q;

      if (error) {
        console.error('Error fetching bank accounts:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!organizationId,
  });

  const createBankAccountMutation = useMutation({
    mutationFn: async (bankAccountData: CreateBankAccountData) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          name: bankAccountData.name,
          account_number: bankAccountData.account_number || null,
          bank_name: bankAccountData.bank_name || null,
          account_holder: bankAccountData.account_holder || null,
          organization_id: organizationId,
          is_active: true,
          created_by: userId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating bank account:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', organizationId] });
      toast({
        title: 'Success',
        description: 'Bank account created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create bank account',
        variant: 'destructive',
      });
    },
  });

  const updateBankAccountMutation = useMutation({
    mutationFn: async ({ id, data: bankAccountData }: { id: string; data: UpdateBankAccountData }) => {
      if (bankAccountData.use_for_omnichannel_income === true && organizationId) {
        const { error: clearErr } = await supabase
          .from('bank_accounts')
          .update({ use_for_omnichannel_income: false })
          .eq('organization_id', organizationId);
        if (clearErr) {
          console.error('Error clearing omnichannel bank flags:', clearErr);
          throw clearErr;
        }
      }

      if (bankAccountData.use_for_gateway_payout === true) {
        throw new Error(
          'Gateway payout must be enabled via Iluma bank validation (Xendit / Bank Accounts).',
        );
      }

      const { data, error } = await supabase
        .from('bank_accounts')
        .update({
          ...bankAccountData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating bank account:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['omnichannel-income-bank-account', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['xendit-settings', organizationId] });
      toast({
        title: 'Success',
        description: 'Bank account updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update bank account',
        variant: 'destructive',
      });
    },
  });

  const deleteBankAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: incomeTransactions } = await supabase
        .from('income_transactions')
        .select('id')
        .eq('bank_account_id', id)
        .limit(1);

      const { data: expenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('bank_account_id', id)
        .limit(1);

      if (
        (incomeTransactions && incomeTransactions.length > 0) ||
        (expenses && expenses.length > 0)
      ) {
        throw new Error(
          'Cannot delete bank account that is used in transactions. Please use soft delete (set inactive) instead.'
        );
      }

      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);

      if (error) {
        console.error('Error deleting bank account:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['omnichannel-income-bank-account', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['bank-account-balances', organizationId] });
      toast({
        title: 'Success',
        description: 'Bank account deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete bank account',
        variant: 'destructive',
      });
    },
  });

  return {
    bankAccounts: bankAccounts as BankAccount[],
    loading,
    isPending,
    refetch,
    createBankAccount: createBankAccountMutation.mutateAsync,
    updateBankAccount: (id: string, data: UpdateBankAccountData) =>
      updateBankAccountMutation.mutateAsync({ id, data }),
    deleteBankAccount: deleteBankAccountMutation.mutateAsync,
  };
};
