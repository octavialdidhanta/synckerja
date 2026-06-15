import { useMemo, useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import {
  useBankMutations,
  type BankMutationsFilter,
} from '@/shared/hooks/finance/useBankMutations';
import { useCanAllocateIncome } from '@/4-1-dashboard/hooks/useCanAllocateIncome';
import type { BankStatementLineWithMatch } from '@/4-1-dashboard/types/bank-mutations';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { formatMutationDateTime, resolveMutationDisplayDate } from '@/shared/utils/formatMutationDateTime';
import { computeMutationErpBalances } from '@/4-1-transaction/lib/computeMutationErpBalances';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Loader2 } from 'lucide-react';
import { RefreshBankMutationsButton } from './RefreshBankMutationsButton';

function getGatewayDrawerLabel(
  row: BankStatementLineWithMatch,
  t: (key: string, fallback: string) => string,
): string | null {
  if (row.origin === 'erp_gateway_withdrawal') {
    return t('incomes.brick.gatewayWithdrawalIn', 'Masuk dari laci Xendit');
  }
  const raw = row.raw_payload as Record<string, unknown> | undefined;
  const provider =
    (typeof raw?.gateway_wallet_provider === 'string' ? raw.gateway_wallet_provider : null) ??
    row.expense?.gateway_wallet_provider;
  if (provider === 'brick') {
    return t('incomes.brick.gatewayBrickDrawer', 'Brick drawer');
  }
  if (provider === 'xendit') {
    return t('incomes.brick.gatewayXenditDrawer', 'Xendit drawer');
  }
  return null;
}

function getExpenseTitle(row: BankStatementLineWithMatch): string {
  return row.expense?.expense_name ?? 'Expense';
}

export function BankMutationsPanel() {
  const { t } = useAppTranslation();
  const { canAllocateIncome } = useCanAllocateIncome();
  const { bankAccounts } = useBankAccounts({ includeInactive: true });
  const { balances } = useBankAccountBalances();

  const [filters, setFilters] = useState<BankMutationsFilter>({
    bankAccountId: 'all',
    direction: 'all',
    matchFilter: 'all',
  });

  const {
    lines,
    loading,
    isError,
    error,
    confirmMatch,
    confirmingMatch,
    confirmExpenseMatch,
    confirmingExpenseMatch,
    rejectMatch,
    rejectingMatch,
  } = useBankMutations(filters);

  const erpBalanceByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of balances) {
      map.set(b.bank_account_id, b.balance);
    }
    return map;
  }, [balances]);

  const erpBalanceByLineId = useMemo(
    () => computeMutationErpBalances(lines, erpBalanceByAccount),
    [lines, erpBalanceByAccount],
  );

  const suggestedCount = useMemo(
    () =>
      lines.reduce(
        (sum, row) =>
          sum + (row.matches ?? []).filter((m) => m.status === 'suggested').length,
        0,
      ),
    [lines],
  );

  return (
    <div className="flex min-h-0 flex-col gap-3 border-t border-gray-200 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            {t('incomes.brick.mutationsTitle', 'Mutasi bank')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t(
              'incomes.brick.mutationsHintOutgoing',
              'Data dari Brick dan Payment Process — deposit masuk dan pengeluaran keluar.',
            )}
          </p>
        </div>
        {canAllocateIncome ? <RefreshBankMutationsButton /> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.bankAccountId}
          onValueChange={(v) => setFilters((f) => ({ ...f, bankAccountId: v }))}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder={t('incomes.brick.filterAccount', 'Rekening')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('incomes.brick.allAccounts', 'Semua rekening')}</SelectItem>
            {bankAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.direction}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, direction: v as BankMutationsFilter['direction'] }))
          }
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('incomes.brick.allDirections', 'Semua')}</SelectItem>
            <SelectItem value="credit">{t('incomes.brick.creditOnly', 'Masuk')}</SelectItem>
            <SelectItem value="debit">{t('incomes.brick.debitOnly', 'Keluar')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.matchFilter}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, matchFilter: v as BankMutationsFilter['matchFilter'] }))
          }
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('incomes.brick.matchAll', 'Semua mutasi')}</SelectItem>
            <SelectItem value="suggested">
              {t('incomes.brick.matchSuggested', 'Ada saran')} ({suggestedCount})
            </SelectItem>
            <SelectItem value="unmatched">{t('incomes.brick.matchUnmatched', 'Belum match')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('incomes.brick.loading', 'Memuat mutasi…')}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-xs text-destructive">
          {t('incomes.brick.loadError', 'Gagal memuat mutasi bank.')}
          {error instanceof Error ? ` ${error.message}` : ''}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden min-h-[200px] max-h-[360px] flex flex-col">
          <div className="overflow-auto seamless-scroll nested-scroll-touch-chain min-h-0 flex-1">
            <Table className="min-w-[880px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[118px]">{t('incomes.brick.colDate', 'Tanggal')}</TableHead>
                  <TableHead className="text-xs w-[168px]">{t('incomes.brick.colAccount', 'Rekening')}</TableHead>
                  <TableHead className="text-xs w-[108px]">{t('incomes.brick.colAmount', 'Jumlah')}</TableHead>
                  <TableHead className="text-xs">{t('incomes.brick.colDesc', 'Deskripsi')}</TableHead>
                  <TableHead className="text-xs w-[220px]">{t('incomes.brick.colMatch', 'Saran')}</TableHead>
                  {canAllocateIncome ? (
                    <TableHead className="text-xs w-32">{t('incomes.brick.colAction', 'Aksi')}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((row) => {
                  const isDebit = row.direction === 'debit';
                  const suggestedIncome = (row.matches ?? []).find(
                    (m) => m.status === 'suggested' && m.income_transaction_id,
                  );
                  const suggestedExpense = (row.matches ?? []).find(
                    (m) => m.status === 'suggested' && m.expense_id,
                  );
                  const confirmedExpenseMatch = (row.matches ?? []).find(
                    (m) => m.status === 'confirmed' && m.expense_id,
                  );
                  const hasRecordedExpense =
                    isDebit && Boolean(row.expense_id || confirmedExpenseMatch);
                  const hasRecordedGatewayWithdrawal =
                    !isDebit && row.origin === 'erp_gateway_withdrawal';
                  const erpBalance = erpBalanceByLineId.get(row.id);
                  const gatewayLabel = getGatewayDrawerLabel(row, t);
                  const expenseTitle = suggestedExpense
                    ? (suggestedExpense.expense?.expense_name ?? getExpenseTitle(row))
                    : getExpenseTitle(row);

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatMutationDateTime(resolveMutationDisplayDate(row))}
                      </TableCell>
                      <TableCell className="text-xs w-[168px] align-top">
                        <div className="whitespace-nowrap">{row.bank_account?.name ?? '-'}</div>
                        {gatewayLabel ? (
                          <div className="text-[10px] text-blue-700 mt-0.5">{gatewayLabel}</div>
                        ) : null}
                        {erpBalance != null ? (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {t('incomes.brick.colErpAfterTxn', 'ERP setelah mutasi')}:{' '}
                            {formatToRupiah(erpBalance)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <span
                          className={
                            row.direction === 'credit' ? 'text-green-700' : 'text-red-600'
                          }
                        >
                          {row.direction === 'credit' ? '+' : '-'}
                          {formatToRupiah(row.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {row.description || row.reference || '-'}
                      </TableCell>
                      <TableCell className="text-xs w-[220px] align-top">
                        {hasRecordedGatewayWithdrawal ? (
                          <div className="space-y-1 min-w-0">
                            <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-800 whitespace-normal">
                              {t('incomes.brick.gatewayWithdrawalRecorded', 'Penarikan Xendit tercatat')}
                            </Badge>
                          </div>
                        ) : hasRecordedExpense ? (
                          <div className="space-y-1 min-w-0">
                            <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-800 whitespace-normal">
                              {t('incomes.brick.expenseRecordedBadge', 'Expense recorded')}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground break-words">
                              {expenseTitle} · {formatToRupiah(row.expense?.amount ?? row.amount)}
                            </div>
                          </div>
                        ) : isDebit && suggestedExpense ? (
                          <div className="space-y-1 min-w-0">
                            <Badge variant="secondary" className="text-[10px] whitespace-normal">
                              {t('incomes.brick.expenseSuggestedBadge', 'Saran expense')}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground break-words">
                              {expenseTitle} ·{' '}
                              {formatToRupiah(suggestedExpense.expense?.amount ?? row.amount)}
                            </div>
                          </div>
                        ) : suggestedIncome ? (
                          <div className="space-y-1 min-w-0">
                            <Badge variant="secondary" className="text-[10px] whitespace-normal">
                              {t('incomes.brick.suggestedBadge', 'Saran match')}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground break-words">
                              {suggestedIncome.income_transaction?.customer_name ?? 'Piutang'} ·{' '}
                              {formatToRupiah(suggestedIncome.income_transaction?.amount ?? row.amount)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canAllocateIncome && isDebit && suggestedExpense ? (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 text-[10px] px-2"
                              disabled={
                                confirmingExpenseMatch ||
                                confirmingMatch ||
                                rejectingMatch
                              }
                              onClick={() => confirmExpenseMatch(suggestedExpense.id)}
                            >
                              {t('incomes.brick.confirmExpense', 'Konfirmasi expense')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2"
                              disabled={
                                confirmingExpenseMatch ||
                                confirmingMatch ||
                                rejectingMatch
                              }
                              onClick={() => rejectMatch(suggestedExpense.id)}
                            >
                              {t('incomes.brick.dismiss', 'Abaikan')}
                            </Button>
                          </div>
                        </TableCell>
                      ) : canAllocateIncome && suggestedIncome ? (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 text-[10px] px-2"
                              disabled={confirmingMatch || rejectingMatch}
                              onClick={() => confirmMatch(suggestedIncome.id)}
                            >
                              {t('incomes.brick.confirmDeposit', 'Konfirmasi')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2"
                              disabled={confirmingMatch || rejectingMatch}
                              onClick={() => rejectMatch(suggestedIncome.id)}
                            >
                              {t('incomes.brick.dismiss', 'Abaikan')}
                            </Button>
                          </div>
                        </TableCell>
                      ) : canAllocateIncome ? (
                        <TableCell />
                      ) : null}
                    </TableRow>
                  );
                })}
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canAllocateIncome ? 6 : 5}
                      className="text-center py-6 text-xs text-muted-foreground"
                    >
                      {t(
                        'incomes.brick.empty',
                        'Belum ada mutasi. Hubungkan rekening ke Brick lalu refresh.',
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
