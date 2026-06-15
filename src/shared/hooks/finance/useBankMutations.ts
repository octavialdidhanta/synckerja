import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type {
  BankMutationMatch,
  BankStatementLineWithMatch,
} from '@/4-1-dashboard/types/bank-mutations';
import {
  linkBankAccountBrick,
  openBrickWidget,
  syncBrickBankMutations,
  unlinkBankAccountBrick,
} from '@/4-1-transaction/lib/brickBankApi';

export type BankMutationsFilter = {
  bankAccountId: string | 'all';
  direction: 'all' | 'credit' | 'debit';
  matchFilter: 'all' | 'suggested' | 'unmatched';
};

export const useBankMutations = (filters: BankMutationsFilter) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const [syncCooldownSec, setSyncCooldownSec] = useState(0);

  useEffect(() => {
    if (syncCooldownSec <= 0) return;
    const timer = window.setInterval(() => {
      setSyncCooldownSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [syncCooldownSec]);

  const queryKey = [
    'bank-statement-lines',
    organizationId,
    filters.bankAccountId,
    filters.direction,
    filters.matchFilter,
  ];

  const { data: lines = [], isLoading, isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return [];

      let q = supabase
        .from('bank_statement_lines')
        .select(
          `
          *,
          bank_account:bank_accounts(id, name, account_number, bank_name),
          expense:expenses!bank_statement_lines_expense_id_fkey(
            id,
            expense_name,
            amount,
            purchase_request_id,
            gateway_wallet_provider,
            purchase_request:purchase_requests(paid_at)
          ),
          matches:bank_mutation_matches(
            id,
            organization_id,
            statement_line_id,
            income_transaction_id,
            sales_activity_payment_id,
            expense_id,
            match_score,
            match_reason,
            status,
            confirmed_by,
            confirmed_at,
            created_at,
            income_transaction:income_transactions(
              id,
              amount,
              transaction_date,
              customer_name,
              status
            ),
            expense:expenses!bank_mutation_matches_expense_id_fkey(
              id,
              expense_name,
              amount,
              purchase_request_id
            )
          )
        `,
        )
        .eq('organization_id', organizationId)
        .order('transaction_date', { ascending: false })
        .limit(200);

      if (filters.bankAccountId !== 'all') {
        q = q.eq('bank_account_id', filters.bankAccountId);
      }
      if (filters.direction !== 'all') {
        q = q.eq('direction', filters.direction);
      }

      const { data, error } = await q;
      if (error) throw error;

      let rows = (data ?? []) as BankStatementLineWithMatch[];

      const erpExpenseIds = new Set(
        rows
          .filter((row) => row.origin === 'erp_expense' && row.expense_id)
          .map((row) => row.expense_id as string),
      );
      rows = rows.filter((row) => {
        if (
          row.expense_id &&
          row.origin !== 'erp_expense' &&
          erpExpenseIds.has(row.expense_id)
        ) {
          return false;
        }
        return true;
      });

      if (filters.matchFilter === 'suggested') {
        rows = rows.filter((row) =>
          (row.matches ?? []).some((m) => m.status === 'suggested'),
        );
      } else if (filters.matchFilter === 'unmatched') {
        rows = rows.filter(
          (row) =>
            !(row.matches ?? []).some(
              (m) => m.status === 'suggested' || m.status === 'confirmed',
            ),
        );
      }

      return rows;
    },
    enabled: Boolean(organizationId),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['bank-statement-lines', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['bank-mutation-matches', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['bank-accounts', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['income-transactions', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['bank-account-balances', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['piutang-payment-verifications'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-requests', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['gateway-wallet-balances', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['gateway-wallet-period-net', organizationId] });
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('Organization required');
      const result = await syncBrickBankMutations(organizationId);
      if ((result.xenditDisbursePoll?.completed ?? 0) === 0) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: stuckRows } = await supabase
          .from('xendit_disbursements')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('source_type', 'purchase_request')
          .in('status', ['pending', 'processing'])
          .gte('created_at', since);
        for (const row of stuckRows ?? []) {
          await supabase.rpc('reconcile_xendit_disbursement_completed', {
            p_disbursement_id: row.id,
          });
        }
      }
      return result;
    },
    onSuccess: (result) => {
      invalidateAll();
      const disburseSummary = result.disbursePoll
        ? ` Brick: ${result.disbursePoll.polled} dipoll, ${result.disbursePoll.completed} selesai${
            result.disbursePoll.reconciled?.resetToPending
              ? `, ${result.disbursePoll.reconciled.resetToPending} payment dikembalikan ke Pending`
              : ''
          }${
            result.disbursePoll.reconciled?.markedPaid
              ? `, ${result.disbursePoll.reconciled.markedPaid} ditandai Paid`
              : ''
          }.`
        : '';
      const xenditDisburseSummary = result.xenditDisbursePoll
        ? ` Xendit: ${result.xenditDisbursePoll.polled} dipoll, ${result.xenditDisbursePoll.completed} selesai.`
        : '';
      const errSummary =
        result.errors?.length > 0
          ? ` ${result.errors.map((e) => e.error).join('; ')}`
          : '';
      const hasDisburseErr =
        (result.disbursePoll?.errors?.length ?? 0) > 0 ||
        (result.xenditDisbursePoll?.errors?.length ?? 0) > 0;
      const hasBlockingErr =
        hasDisburseErr ||
        (result.errors?.some((e) => e.name !== 'brick-topup') ?? false);
      const brickNew = result.newLines ?? 0;
      const matches = result.suggestedMatches ?? 0;
      const baseDescription =
        brickNew === 0
          ? t(
              'bankMutations.syncUpdatedZeroBrick',
              '{{brickNew}} baris baru dari Brick API, {{matches}} saran match. Mutasi keluar Xendit/Payment Process tidak dihitung di sini — sudah tampil di tabel jika disbursement selesai.',
              { brickNew, matches },
            )
          : t(
              'bankMutations.syncUpdatedWithBrick',
              '{{brickNew}} baris baru dari Brick API, {{matches}} saran match.',
              { brickNew, matches },
            );
      toast({
        title: t('bankMutations.syncUpdatedTitle', 'Mutasi diperbarui'),
        description: `${baseDescription}${
          result.fetchedFromBrick != null ? ` Brick API: ${result.fetchedFromBrick} transaksi.` : ''
        }${disburseSummary}${xenditDisburseSummary}${errSummary}`,
        variant: hasBlockingErr ? 'destructive' : 'default',
      });
    },
    onError: (e: Error) => {
      const waitMatch = e.message.match(/tunggu (\d+) detik/i);
      if (waitMatch) {
        setSyncCooldownSec(Number(waitMatch[1]));
      }
      toast({
        title: t('bankMutations.syncFailedTitle', 'Gagal refresh mutasi'),
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (bankAccountId: string) => {
      if (!organizationId) throw new Error('Organization required');
      const result = await linkBankAccountBrick(organizationId, bankAccountId);
      if (result.widgetUrl) openBrickWidget(result.widgetUrl);
      return result;
    },
    onSuccess: () => {
      invalidateAll();
      toast({
        title: 'Brick Widget dibuka',
        description: 'Selesaikan login bank di widget Brick. Mutasi akan disinkron setelah berhasil.',
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Gagal hubungkan Brick',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (bankAccountId: string) => {
      if (!organizationId) throw new Error('Organization required');
      return unlinkBankAccountBrick(organizationId, bankAccountId);
    },
    onSuccess: () => {
      invalidateAll();
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

  const confirmMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc('confirm_bank_mutation_match', {
        p_match_id: matchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Deposit dikonfirmasi dari mutasi bank' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Gagal konfirmasi',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc('reject_bank_mutation_match', {
        p_match_id: matchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Saran match diabaikan' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Gagal abaikan saran',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const confirmExpenseMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc('confirm_bank_expense_mutation_match', {
        p_match_id: matchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Pengeluaran dikonfirmasi dari mutasi bank' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Gagal konfirmasi pengeluaran',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  return {
    lines,
    loading: isPending,
    isError,
    error,
    isPending,
    refetch,
    syncMutations: syncMutation.mutateAsync,
    syncing: syncMutation.isPending,
    syncCooldownSec,
    linkBrick: linkMutation.mutateAsync,
    linkingBrick: linkMutation.isPending,
    unlinkBrick: unlinkMutation.mutateAsync,
    unlinkingBrick: unlinkMutation.isPending,
    confirmMatch: confirmMatchMutation.mutateAsync,
    confirmingMatch: confirmMatchMutation.isPending,
    confirmExpenseMatch: confirmExpenseMatchMutation.mutateAsync,
    confirmingExpenseMatch: confirmExpenseMatchMutation.isPending,
    rejectMatch: rejectMatchMutation.mutateAsync,
    rejectingMatch: rejectMatchMutation.isPending,
  };
};

export const useSuggestedMatchesForPayment = (paymentId: string | null | undefined) => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['bank-mutation-matches', organizationId, 'payment', paymentId],
    queryFn: async () => {
      if (!organizationId || !paymentId) return [];

      const { data, error } = await supabase
        .from('bank_mutation_matches')
        .select(
          `
          *,
          statement_line:bank_statement_lines(
            id,
            transaction_date,
            amount,
            direction,
            description,
            reference,
            counterparty_name,
            bank_account_id
          )
        `,
        )
        .eq('organization_id', organizationId)
        .eq('sales_activity_payment_id', paymentId)
        .eq('status', 'suggested');

      if (error) throw error;
      return (data ?? []) as BankMutationMatch[];
    },
    enabled: Boolean(organizationId && paymentId),
  });
};
