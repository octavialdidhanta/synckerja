import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  openBrickWidget,
  startBrickOAuth,
  syncBrickBankMutations,
  unlinkBankAccountBrick,
  unlinkBrickDebt,
  type BrickOAuthTargetType,
} from '@/4-1-transaction/lib/brickBankApi';

export function useBrickFinancialOAuth() {
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    (targetType: BrickOAuthTargetType) => {
      if (targetType === 'bank_account') {
        queryClient.invalidateQueries({ queryKey: ['bank-accounts', organizationId] });
        queryClient.invalidateQueries({ queryKey: ['bank-statement-lines', organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['organization-debts', organizationId] });
        queryClient.invalidateQueries({ queryKey: ['expenses', organizationId] });
      }
    },
    [organizationId, queryClient],
  );

  const startOAuth = useMutation({
    mutationFn: async (params: {
      targetType: BrickOAuthTargetType;
      targetId: string;
      returnPath?: string;
    }) => {
      if (!organizationId) throw new Error('Organization required');
      const result = await startBrickOAuth({
        organizationId,
        targetType: params.targetType,
        targetId: params.targetId,
        returnPath: params.returnPath,
      });
      openBrickWidget(result.widgetUrl!, { connectMode: result.connectMode });
      return result;
    },
    onSuccess: (_, vars) => {
      invalidate(vars.targetType);
      toast({
        title: 'Brick Widget dibuka',
        description: 'Selesaikan login bank di jendela Brick untuk menghubungkan akun.',
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Gagal membuka Brick Widget',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const unlink = useMutation({
    mutationFn: async (params: { targetType: BrickOAuthTargetType; targetId: string }) => {
      if (!organizationId) throw new Error('Organization required');
      if (params.targetType === 'bank_account') {
        return unlinkBankAccountBrick(organizationId, params.targetId);
      }
      return unlinkBrickDebt(organizationId, params.targetId);
    },
    onSuccess: (_, vars) => {
      invalidate(vars.targetType);
      toast({ title: 'Koneksi Brick diputus' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Gagal putuskan Brick',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const syncTarget = useMutation({
    mutationFn: async (params?: { bankAccountId?: string; debtId?: string }) => {
      if (!organizationId) throw new Error('Organization required');
      return syncBrickBankMutations(organizationId, params);
    },
    onSuccess: (result, params) => {
      if (params?.debtId) {
        invalidate('debt');
      } else {
        invalidate('bank_account');
      }
      const ccPart =
        result.importedExpenses != null && result.importedExpenses > 0
          ? ` ${result.importedExpenses} expense kartu kredit diimpor.`
          : '';
      toast({
        title: 'Sinkron Brick selesai',
        description: `${result.newLines} mutasi bank, ${result.newDebtLines ?? 0} mutasi kartu kredit.${ccPart}`,
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Gagal sinkron Brick',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  return {
    startOAuth: startOAuth.mutateAsync,
    startingOAuth: startOAuth.isPending,
    unlinkBrick: unlink.mutateAsync,
    unlinkingBrick: unlink.isPending,
    syncBrick: syncTarget.mutateAsync,
    syncingBrick: syncTarget.isPending,
  };
}
