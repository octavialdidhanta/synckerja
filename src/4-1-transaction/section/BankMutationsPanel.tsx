import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { BANK_MUTATIONS_BASE_PATH } from '@/4-1-bank-mutations/lib/bankMutationsPaths';
import { BANK_MUTATIONS_TABLE_BODY_SCROLL } from '@/4-1-bank-mutations/layout/bankMutationsLayout';
import { cn } from '@/shared/lib/utils';
import { Loader2 } from 'lucide-react';
import { RefreshBankMutationsButton } from './RefreshBankMutationsButton';
import { BankMutationsTableFooter } from '@/4-1-bank-mutations/section/BankMutationsTableFooter';
import { useXenditOrgSettings } from '@/xendit/hooks/useXenditOrgSettings';
import { resolveSubAccountLabelByXenditId } from '@/xendit/lib/xenditSubAccountUtils';
import type { XenditSubAccountRow } from '@/xendit/types/xendit';

type PanelLayout = 'embedded' | 'page';

function getSubAccountLabelFromPayload(
  row: BankStatementLineWithMatch,
  subAccounts: XenditSubAccountRow[] | undefined,
): string | null {
  const raw = row.raw_payload as Record<string, unknown> | undefined;
  const subId = typeof raw?.sub_account_id === 'string' ? raw.sub_account_id : null;
  return resolveSubAccountLabelByXenditId(subAccounts, subId);
}

function getGatewayDrawerLabel(
  row: BankStatementLineWithMatch,
  subAccounts: XenditSubAccountRow[] | undefined,
  copy: {
    sourceXenditTransfer: string;
    sourceXenditWallet: string;
    sourceBrickWallet: string;
  },
): string | null {
  const subLabel = getSubAccountLabelFromPayload(row, subAccounts);
  if (row.origin === 'erp_gateway_withdrawal') {
    const base = copy.sourceXenditTransfer;
    return subLabel ? `${base} · ${subLabel}` : base;
  }
  const raw = row.raw_payload as Record<string, unknown> | undefined;
  const provider =
    (typeof raw?.gateway_wallet_provider === 'string' ? raw.gateway_wallet_provider : null) ??
    row.expense?.gateway_wallet_provider;
  if (provider === 'brick') {
    return copy.sourceBrickWallet;
  }
  if (provider === 'xendit') {
    const base = copy.sourceXenditWallet;
    return subLabel ? `${base} · ${subLabel}` : base;
  }
  return null;
}

function getExpenseTitle(row: BankStatementLineWithMatch): string {
  return row.expense?.expense_name ?? 'Expense';
}

function useMutationCopy(layout: PanelLayout) {
  const { t } = useAppTranslation();
  const isPage = layout === 'page';
  const ns = isPage ? 'finance.bankMutations' : 'incomes.brick';

  return useMemo(
    () => ({
      filterAccount: t(`${ns}.filterAccount`, isPage ? 'Rekening' : 'Rekening'),
      allAccounts: t(
        isPage ? 'finance.bankMutations.allAccounts' : 'incomes.brick.allAccounts',
        'Semua rekening',
      ),
      filterFlow: t('finance.bankMutations.filterFlow', 'Arah'),
      flowAll: t(
        isPage ? 'finance.bankMutations.flowAll' : 'incomes.brick.allDirections',
        'Semua',
      ),
      flowIn: t(
        isPage ? 'finance.bankMutations.flowIn' : 'incomes.brick.creditOnly',
        'Uang masuk',
      ),
      flowOut: t(
        isPage ? 'finance.bankMutations.flowOut' : 'incomes.brick.debitOnly',
        'Uang keluar',
      ),
      filterMatching: t('finance.bankMutations.filterMatching', 'Status'),
      matchingAll: t(
        isPage ? 'finance.bankMutations.matchingAll' : 'incomes.brick.matchAll',
        'Semua',
      ),
      matchingNeedsReview: t(
        isPage ? 'finance.bankMutations.matchingNeedsReview' : 'incomes.brick.matchSuggested',
        'Perlu dicek',
      ),
      matchingUnmatched: t(
        isPage ? 'finance.bankMutations.matchingUnmatched' : 'incomes.brick.matchUnmatched',
        'Belum dicocokkan',
      ),
      loading: t(`${ns}.loading`, 'Memuat…'),
      loadError: t(`${ns}.loadError`, 'Gagal memuat data rekening.'),
      empty: t(`${ns}.empty`, 'Belum ada transaksi.'),
      colDate: t(`${ns}.colDate`, 'Tanggal'),
      colAccount: t(`${ns}.colAccount`, 'Rekening'),
      colAmount: t(`${ns}.colAmount`, 'Nominal'),
      colDescription: t(
        isPage ? 'finance.bankMutations.colDescription' : 'incomes.brick.colDesc',
        'Keterangan',
      ),
      colStatus: t(
        isPage ? 'finance.bankMutations.colStatus' : 'incomes.brick.colMatch',
        'Status',
      ),
      colAction: t(`${ns}.colAction`, 'Tindakan'),
      balanceAfter: t(
        isPage ? 'finance.bankMutations.balanceAfter' : 'incomes.brick.colErpAfterTxn',
        'Saldo setelah',
      ),
      sourceXenditTransfer: t(
        isPage ? 'finance.bankMutations.sourceXenditTransfer' : 'incomes.brick.gatewayWithdrawalIn',
        'Transfer dari pembayaran online',
      ),
      sourceXenditWallet: t(
        isPage ? 'finance.bankMutations.sourceXenditWallet' : 'incomes.brick.gatewayXenditDrawer',
        'Dari saldo Xendit',
      ),
      sourceBrickWallet: t(
        isPage ? 'finance.bankMutations.sourceBrickWallet' : 'incomes.brick.gatewayBrickDrawer',
        'Dari saldo Brick',
      ),
      statusRecordedWithdrawal: t(
        isPage
          ? 'finance.bankMutations.statusRecordedWithdrawal'
          : 'incomes.brick.gatewayWithdrawalRecorded',
        'Sudah tercatat',
      ),
      statusRecordedExpense: t(
        isPage ? 'finance.bankMutations.statusRecordedExpense' : 'incomes.brick.expenseRecordedBadge',
        'Pengeluaran tercatat',
      ),
      statusSuggestedExpense: t(
        isPage ? 'finance.bankMutations.statusSuggestedExpense' : 'incomes.brick.expenseSuggestedBadge',
        'Kemungkinan pengeluaran',
      ),
      statusSuggestedIncome: t(
        isPage ? 'finance.bankMutations.statusSuggestedIncome' : 'incomes.brick.suggestedBadge',
        'Kemungkinan pendapatan',
      ),
      confirmIncome: t(
        isPage ? 'finance.bankMutations.confirmIncome' : 'incomes.brick.confirmDeposit',
        'Catat pendapatan',
      ),
      confirmExpense: t(
        isPage ? 'finance.bankMutations.confirmExpense' : 'incomes.brick.confirmExpense',
        'Catat pengeluaran',
      ),
      dismiss: t(`${ns}.dismiss`, 'Abaikan'),
      mutationsTitle: t('incomes.brick.mutationsTitle', 'Mutasi bank'),
      mutationsHint: t('incomes.brick.mutationsHintOutgoing', 'Uang masuk dan keluar di rekening Anda.'),
    }),
    [t, isPage, ns],
  );
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-[148px] flex-col gap-1', className)}>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function BankMutationsPanel({
  layout = 'embedded',
  onLoadingOverlayChange,
}: {
  layout?: PanelLayout;
  onLoadingOverlayChange?: (showOverlay: boolean) => void;
}) {
  const { dateLocale } = useAppTranslation();
  const copy = useMutationCopy(layout);
  const { organizationId } = useCurrentOrg();
  const { data: xenditSettings } = useXenditOrgSettings(organizationId);
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { canAllocateIncome } = useCanAllocateIncome();
  const isPage = layout === 'page';
  const {
    bankAccounts,
    loading: bankAccountsLoading,
    isPending: bankAccountsPending,
  } = useBankAccounts({ includeInactive: true });
  const {
    balances,
    loading: balancesLoading,
    isPending: balancesPending,
  } = useBankAccountBalances();

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

  const dataPending =
    Boolean(organizationId) &&
    (bankAccountsLoading ||
      bankAccountsPending ||
      balancesLoading ||
      balancesPending ||
      loading);
  const rawPendingLoad = orgBootstrapPending || dataPending;
  const { showFullPageSkeleton, accessReady } = useModulePageOverlaySkeleton(
    rawPendingLoad,
    BANK_MUTATIONS_BASE_PATH,
  );
  const showContent = useDebouncedReady(accessReady && !showFullPageSkeleton, 220);

  useEffect(() => {
    if (isPage) {
      onLoadingOverlayChange?.(!showContent);
    }
  }, [isPage, onLoadingOverlayChange, showContent]);

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

  const renderTableBodyRows = () =>
    lines.map((row) => {
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
      const hasRecordedExpense = isDebit && Boolean(row.expense_id || confirmedExpenseMatch);
      const hasRecordedGatewayWithdrawal = !isDebit && row.origin === 'erp_gateway_withdrawal';
      const erpBalance = erpBalanceByLineId.get(row.id);
      const gatewayLabel = getGatewayDrawerLabel(row, xenditSettings?.subAccounts, copy);
      const expenseTitle = suggestedExpense
        ? (suggestedExpense.expense?.expense_name ?? getExpenseTitle(row))
        : getExpenseTitle(row);
      const description = row.description || row.reference || '—';

      return (
        <TableRow key={row.id} className="align-top">
          <TableCell className="whitespace-nowrap text-xs">
            {formatMutationDateTime(resolveMutationDisplayDate(row), dateLocale)}
          </TableCell>
          <TableCell className="max-w-[160px] text-xs">
            <div className="truncate font-medium">{row.bank_account?.name ?? '—'}</div>
          </TableCell>
          <TableCell className="whitespace-nowrap text-xs">
            <div
              className={cn(
                'font-semibold',
                row.direction === 'credit' ? 'text-green-700' : 'text-red-600',
              )}
            >
              {row.direction === 'credit' ? '+' : '-'}
              {formatToRupiah(row.amount)}
            </div>
            {erpBalance != null ? (
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {copy.balanceAfter}: {formatToRupiah(erpBalance)}
              </div>
            ) : null}
          </TableCell>
          <TableCell className="text-xs">
            <div className="line-clamp-2 break-words">{description}</div>
            {gatewayLabel ? (
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {gatewayLabel}
              </div>
            ) : null}
          </TableCell>
          <TableCell className="text-xs">
            {hasRecordedGatewayWithdrawal ? (
              <Badge
                variant="secondary"
                className="whitespace-normal bg-green-50 text-[10px] text-green-800"
              >
                {copy.statusRecordedWithdrawal}
              </Badge>
            ) : hasRecordedExpense ? (
              <div className="space-y-1">
                <Badge
                  variant="secondary"
                  className="whitespace-normal bg-green-50 text-[10px] text-green-800"
                >
                  {copy.statusRecordedExpense}
                </Badge>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  {expenseTitle} · {formatToRupiah(row.expense?.amount ?? row.amount)}
                </p>
              </div>
            ) : isDebit && suggestedExpense ? (
              <div className="space-y-1">
                <Badge variant="secondary" className="whitespace-normal text-[10px]">
                  {copy.statusSuggestedExpense}
                </Badge>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  {expenseTitle} ·{' '}
                  {formatToRupiah(suggestedExpense.expense?.amount ?? row.amount)}
                </p>
              </div>
            ) : suggestedIncome ? (
              <div className="space-y-1">
                <Badge variant="secondary" className="whitespace-normal text-[10px]">
                  {copy.statusSuggestedIncome}
                </Badge>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  {suggestedIncome.income_transaction?.customer_name ?? 'Piutang'} ·{' '}
                  {formatToRupiah(suggestedIncome.income_transaction?.amount ?? row.amount)}
                </p>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
          {canAllocateIncome && isDebit && suggestedExpense ? (
            <TableCell className="align-top">
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  className="h-8 w-full px-2 text-[11px]"
                  disabled={confirmingExpenseMatch || confirmingMatch || rejectingMatch}
                  onClick={() => confirmExpenseMatch(suggestedExpense.id)}
                >
                  {copy.confirmExpense}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-full px-2 text-[11px]"
                  disabled={confirmingExpenseMatch || confirmingMatch || rejectingMatch}
                  onClick={() => rejectMatch(suggestedExpense.id)}
                >
                  {copy.dismiss}
                </Button>
              </div>
            </TableCell>
          ) : canAllocateIncome && suggestedIncome ? (
            <TableCell className="align-top">
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  className="h-8 w-full px-2 text-[11px]"
                  disabled={confirmingMatch || rejectingMatch}
                  onClick={() => confirmMatch(suggestedIncome.id)}
                >
                  {copy.confirmIncome}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-full px-2 text-[11px]"
                  disabled={confirmingMatch || rejectingMatch}
                  onClick={() => rejectMatch(suggestedIncome.id)}
                >
                  {copy.dismiss}
                </Button>
              </div>
            </TableCell>
          ) : canAllocateIncome ? (
            <TableCell />
          ) : null}
        </TableRow>
      );
    });

  const filterToolbar = (
    <div
      className={cn(
        'flex flex-wrap items-end gap-3',
        isPage ? 'px-4 py-3' : 'gap-2',
      )}
    >
      <FilterField label={copy.filterAccount}>
        <Select
          value={filters.bankAccountId}
          onValueChange={(v) => setFilters((f) => ({ ...f, bankAccountId: v }))}
        >
          <SelectTrigger className={cn('h-9 w-full text-xs', isPage && 'min-w-[168px]')}>
            <SelectValue placeholder={copy.filterAccount} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.allAccounts}</SelectItem>
            {bankAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label={copy.filterFlow}>
        <Select
          value={filters.direction}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, direction: v as BankMutationsFilter['direction'] }))
          }
        >
          <SelectTrigger className={cn('h-9 w-full text-xs', isPage && 'min-w-[140px]')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.flowAll}</SelectItem>
            <SelectItem value="credit">{copy.flowIn}</SelectItem>
            <SelectItem value="debit">{copy.flowOut}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label={copy.filterMatching}>
        <Select
          value={filters.matchFilter}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, matchFilter: v as BankMutationsFilter['matchFilter'] }))
          }
        >
          <SelectTrigger className={cn('h-9 w-full text-xs', isPage && 'min-w-[156px]')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.matchingAll}</SelectItem>
            <SelectItem value="suggested">
              {copy.matchingNeedsReview} ({suggestedCount})
            </SelectItem>
            <SelectItem value="unmatched">{copy.matchingUnmatched}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      {isPage && canAllocateIncome ? (
        <div className="ml-auto flex-shrink-0 pb-0.5">
          <RefreshBankMutationsButton className="h-9" />
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        isPage
          ? 'flex h-full min-h-0 min-w-0 flex-col overflow-hidden'
          : 'flex min-h-0 flex-col gap-3 border-t border-gray-200 pt-3',
      )}
    >
      {!isPage ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{copy.mutationsTitle}</h4>
            <p className="text-xs text-muted-foreground">{copy.mutationsHint}</p>
          </div>
          {canAllocateIncome ? <RefreshBankMutationsButton /> : null}
        </div>
      ) : null}

      <div
        className={cn(
          'flex-shrink-0',
          isPage && 'border-b border-border bg-muted/20',
        )}
      >
        {filterToolbar}
      </div>

      {loading && !isPage ? (
        <div className="flex flex-1 items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {copy.loading}
        </div>
      ) : isError ? (
        <div
          className={cn(
            'rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive',
            isPage ? 'mx-4 my-4' : '',
          )}
        >
          {copy.loadError}
          {error instanceof Error ? ` ${error.message}` : ''}
        </div>
      ) : (
        isPage ? (
          <>
            <div className={BANK_MUTATIONS_TABLE_BODY_SCROLL}>
              <Table
                className="min-w-[960px]"
                containerClassName="h-full w-full overflow-visible"
              >
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap bg-card text-xs">
                      {copy.colDate}
                    </TableHead>
                    <TableHead className="bg-card text-xs">{copy.colAccount}</TableHead>
                    <TableHead className="whitespace-nowrap bg-card text-xs">
                      {copy.colAmount}
                    </TableHead>
                    <TableHead className="min-w-[200px] bg-card text-xs">
                      {copy.colDescription}
                    </TableHead>
                    <TableHead className="min-w-[180px] bg-card text-xs">
                      {copy.colStatus}
                    </TableHead>
                    {canAllocateIncome ? (
                      <TableHead className="w-[112px] whitespace-nowrap bg-card text-xs">
                        {copy.colAction}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderTableBodyRows()}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canAllocateIncome ? 6 : 5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        {copy.empty}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <BankMutationsTableFooter filteredCount={lines.length} suggestedCount={suggestedCount} />
          </>
        ) : (
            <div className="max-h-[360px] min-h-[200px] overflow-y-auto rounded-lg border">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{copy.colDate}</TableHead>
                    <TableHead className="text-xs">{copy.colAccount}</TableHead>
                    <TableHead className="text-xs">{copy.colAmount}</TableHead>
                    <TableHead className="text-xs">{copy.colDescription}</TableHead>
                    <TableHead className="text-xs">{copy.colStatus}</TableHead>
                    {canAllocateIncome ? (
                      <TableHead className="text-xs">{copy.colAction}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderTableBodyRows()}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canAllocateIncome ? 6 : 5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        {copy.empty}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
        )
      )}
    </div>
  );
}
