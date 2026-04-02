import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';
import { Debt, CreateDebtData, UpdateDebtData } from '../types';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { deleteDebtWithPaymentRefunds } from '../services/deleteDebtWithPaymentRefunds';
import { ORGANIZATION_DEBTS_QUERY_KEY } from '@/shared/lib/organizationDebtsQuery';
import { useOrganizationDebtsQuery } from '@/shared/hooks/finance/useOrganizationDebtsQuery';
import { useState } from 'react';

export const useDebts = () => {
  const { t } = useAppTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { organizationId } = useCurrentOrg();
  const { updateBalance } = useBankAccountBalances();
  const queryClient = useQueryClient();

  const { data, isPending, refetch } = useOrganizationDebtsQuery();

  const debts = data?.debts ?? [];
  const totalInterestYtd = data?.totalInterestYtd ?? 0;

  const invalidateDebts = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ORGANIZATION_DEBTS_QUERY_KEY(organizationId) });
    }
  };

  const createDebt = async (debtData: CreateDebtData): Promise<boolean> => {
    if (!organizationId) {
      toast.error(t('debt.error.orgNotFound', 'Organization not found'));
      return false;
    }

    try {
      setIsCreating(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error(t('debt.error.userNotAuth', 'User not authenticated'));
        return false;
      }

      const isOnlineLoan = debtData.debt_type === 'Pinjaman Online';

      let calculatedDebtAmount: number;
      let calculatedAvailableLimit: number | null;
      let calculatedPaidAmount: number | null;

      if (isOnlineLoan) {
        const totalLimit = debtData.limit_amount;
        calculatedDebtAmount = 0;
        calculatedAvailableLimit = totalLimit;
        calculatedPaidAmount = 0;
      } else {
        calculatedDebtAmount = debtData.debt_amount ?? 0;
        if (debtData.available_limit != null && debtData.available_limit > 0) {
          calculatedAvailableLimit = debtData.available_limit;
        } else {
          calculatedAvailableLimit = debtData.limit_amount;
        }
        calculatedPaidAmount = debtData.paid_amount || null;
      }

      const { error } = await supabase
        .from('debts')
        .insert({
          organization_id: organizationId,
          created_by: userData.user.id,
          debt_name: debtData.debt_name,
          debt_type: debtData.debt_type,
          bank_name: debtData.bank_name || null,
          limit_amount: debtData.limit_amount,
          available_limit: calculatedAvailableLimit,
          debt_amount: calculatedDebtAmount,
          paid_amount: calculatedPaidAmount,
          loan_duration: debtData.loan_duration || null,
          monthly_payment: debtData.monthly_payment || null,
          interest_rate: debtData.interest_rate || null,
          due_date: debtData.due_date || null,
          minimum_payment: debtData.minimum_payment || null,
          description: debtData.description || null,
          status: debtData.status || 'active',
        })
        .select()
        .single();

      if (error) throw error;

      invalidateDebts();
      toast.success(t('debt.success.added', 'Debt added successfully'));
      return true;
    } catch (error: any) {
      console.error('Error creating debt:', error);
      toast.error(error.message || t('debt.error.addFailed', 'Failed to add debt'));
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const updateDebt = async (debtData: UpdateDebtData): Promise<boolean> => {
    if (!organizationId) {
      toast.error(t('debt.error.orgNotFound', 'Organization not found'));
      return false;
    }

    try {
      setIsUpdating(true);
      const { id, ...updateData } = debtData;

      const currentDebt = debts.find((d) => d.id === id);
      const debtType = updateData.debt_type ?? currentDebt?.debt_type;
      const isOnlineLoan = debtType === 'Pinjaman Online';

      if (
        updateData.limit_amount !== undefined ||
        updateData.available_limit !== undefined ||
        updateData.debt_amount !== undefined ||
        isOnlineLoan
      ) {
        const newLimit = updateData.limit_amount ?? currentDebt?.limit_amount ?? 0;
        const newAvailable = updateData.available_limit ?? currentDebt?.available_limit;
        const newDebtAmount = updateData.debt_amount ?? currentDebt?.debt_amount ?? 0;

        if (isOnlineLoan) {
          const currentDebtAmount = currentDebt?.debt_amount ?? 0;
          updateData.debt_amount = currentDebtAmount;
          updateData.paid_amount = currentDebt?.paid_amount ?? 0;
          updateData.available_limit = Math.max(0, newLimit - currentDebtAmount);
        } else {
          if (newAvailable != null && newAvailable > 0) {
            updateData.available_limit = newAvailable;
            updateData.debt_amount = newLimit - newAvailable;
          } else {
            updateData.available_limit = newLimit;
            updateData.debt_amount = 0;
          }
        }
      }

      const { error } = await supabase
        .from('debts')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;

      invalidateDebts();
      toast.success(t('debt.success.updated', 'Debt updated successfully'));
      return true;
    } catch (error: any) {
      console.error('Error updating debt:', error);
      toast.error(error.message || t('debt.error.updateFailed', 'Failed to update debt'));
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteDebt = async (debtId: string): Promise<boolean> => {
    if (!organizationId) {
      toast.error(t('debt.error.orgNotFound', 'Organization not found'));
      return false;
    }

    try {
      const debt = debts.find((d) => d.id === debtId);
      const result = await deleteDebtWithPaymentRefunds({
        organizationId,
        debtId,
        debtDisplayName: debt?.debt_name ?? 'Debt',
        updateBalance,
      });

      if (!result.ok) {
        toast.error(result.message || t('debt.error.deleteFailed', 'Failed to delete debt'));
        return false;
      }

      invalidateDebts();
      toast.success(t('debt.success.deleted', 'Debt deleted successfully'));
      return true;
    } catch (error: unknown) {
      console.error('Error deleting debt:', error);
      toast.error(
        error instanceof Error ? error.message : t('debt.error.deleteFailed', 'Failed to delete debt'),
      );
      return false;
    }
  };

  return {
    debts,
    totalInterestYtd,
    isLoading: isPending,
    isCreating,
    isUpdating,
    createDebt,
    updateDebt,
    deleteDebt,
    refetch,
  };
};
