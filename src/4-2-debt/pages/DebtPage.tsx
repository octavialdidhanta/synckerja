import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import { HeaderAndTab } from '@/4-2-dashboard/section/HeaderAndTab';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { DebtPageSkeleton } from '@/4-2-debt/skeletons/DebtPageSkeleton';
import { useDebts } from '../hooks';
import { DebtTable, DebtForm, DebtPaymentHistoryModal } from '../components';
import { DebtPaymentModal } from '../components/DebtPaymentModal';
import { Debt, CreateDebtData, UpdateDebtData } from '../types';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import {
  submitDebtPayment,
  type DebtPaymentModalSubmitPayload,
} from '@/4-2-debt/services/submitDebtPayment';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { debtDisplayBalance, resolveDebtDisplay } from '../utils/resolveDebtDisplay';

/**
 * Seamless Page Scroll Layout (`.cursor/rules/Seamless Page Scroll Layout.mdc`):
 * AppShell sudah punya scroll — root `h-full min-h-0 flex-1 overflow-hidden` (bukan `h-screen`).
 * HeaderAndTab di dalam satu kolom scroll utama; wrapper tanpa `max-h-[calc(100vh-120px)]`.
 */
const DEBT_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const DebtPage = () => {
  const [activeTab, setActiveTab] = useState('debt');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentHistoryDebt, setPaymentHistoryDebt] = useState<Debt | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const { t } = useAppTranslation();
  const { debts, totalInterestYtd, isLoading, isCreating, isUpdating, createDebt, updateDebt, deleteDebt, refetch: refetchDebts } = useDebts();
  const {
    balances: bankAccountBalances,
    loading: balancesLoading,
    isPending: balancesPending,
    updateBalance,
  } = useBankAccountBalances();
  const {
    bankAccounts,
    loading: bankAccountsLoading,
    isPending: bankAccountsPending,
  } = useBankAccounts();
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();

  const dataPending =
    Boolean(organizationId) &&
    (isLoading ||
      balancesLoading ||
      balancesPending ||
      bankAccountsLoading ||
      bankAccountsPending);
  const rawPendingLoad = orgBootstrapPending || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad);
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleAddClick = () => {
    setEditingDebt(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (debt: Debt) => {
    setEditingDebt(debt);
    setIsFormOpen(true);
  };

  const handleDeleteClick = async (debtId: string) => {
    if (
      confirm(
        t(
          'debt.deleteConfirm',
          'Delete this debt? Amounts paid from bank accounts will be refunded to those account balances.'
        )
      )
    ) {
      await deleteDebt(debtId);
    }
  };

  const handleViewDetails = (debt: Debt) => {
    setSelectedDebt(debt);
    setIsDetailModalOpen(true);
  };

  const handlePayDebt = () => {
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (paymentData: DebtPaymentModalSubmitPayload): Promise<boolean> => {
    const debt = debts.find((d) => d.id === paymentData.debtId);
    if (!debt) return false;
    if (!organizationId || !user?.id) {
      console.error('Missing organizationId or user.id');
      return false;
    }

    return submitDebtPayment({
      organizationId,
      userId: user.id,
      debtId: paymentData.debtId,
      paymentAmount: paymentData.paymentAmount,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes ?? null,
      transactionReference: paymentData.transactionReference ?? null,
      receiptFile: paymentData.receiptFile ?? null,
      income_allocation: paymentData.incomeAllocation ?? null,
      debtDisplayName: debt.debt_name,
      updateBalance,
      onAfterSuccess: async () => {
        await refetchDebts();
        await queryClient.invalidateQueries({ queryKey: ['income-transactions', organizationId] });
      },
      messages: {
        duplicateTransactionRef: t(
          'debt.payment.duplicateTransactionRef',
          'This transaction ID is already recorded for this organization.'
        ),
        receiptUploadFailed: t('debt.payment.receiptUploadFailed', 'Failed to upload receipt.'),
        paymentInsertFailed: t('debt.payment.insertFailed', 'Failed to record payment.'),
        bankAccountRequired: t(
          'debt.payment.bankAccountRequired',
          'Pilih rekening sumber dana untuk melanjutkan pembayaran.'
        ),
        rollbackFailed: t(
          'debt.payment.rollbackFailed',
          'Pembayaran tidak selesai. Muat ulang halaman dan coba lagi.'
        ),
        allocationLinkFailed: t(
          'debt.payment.allocationLinkFailed',
          'Could not link this payment to the selected income. The payment was not saved. Check amounts and account, then try again.'
        ),
      },
    });
  };

  const handlePaymentClose = () => {
    setIsPaymentModalOpen(false);
  };

  const handleFormSubmit = async (data: CreateDebtData): Promise<boolean> => {
    if (editingDebt) {
      const updateData: UpdateDebtData = {
        id: editingDebt.id,
        ...data,
      };
      return await updateDebt(updateData);
    } else {
      return await createDebt(data);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingDebt(null);
  };

  const totalDebt = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0);
  }, [debts]);

  const totalLimit = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debt.limit_amount, 0);
  }, [debts]);

  const activeDebts = useMemo(() => {
    return debts.filter(d => d.status === 'active');
  }, [debts]);

  const activeDebtTotal = useMemo(() => {
    return activeDebts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0);
  }, [activeDebts]);

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col',
          !showContent && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className={cn(MAIN_SCROLL, 'min-w-0')}>
              <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                <div className="mb-1 min-w-0 flex-shrink-0">
                  <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
                </div>

                <div className={DEBT_MAIN_GRID}>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0 shrink-0">
                      <Card className="w-full min-w-0 border-0 bg-brand-blue text-white">
                        <CardContent className="p-3 min-w-0">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                                  <DollarSign className="h-4 w-4 text-white" />
                                </div>
                                <span className="text-sm font-medium text-white/90 truncate">{t('expenses.quickViewTotalBalance', 'Quick View Total Current Balance')}</span>
                              </div>
                              <Link
                                to="/incomes/dashboard"
                                className="inline-flex flex-shrink-0 group rounded-lg p-2"
                              >
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-white text-brand-blue hover:bg-white/90 hover:text-brand-blue group-hover:bg-white/90 group-hover:text-brand-blue group-focus-visible:bg-white/90 group-focus-visible:text-brand-blue transition-colors border-0 font-medium whitespace-nowrap"
                                >
                                  {t('expenses.goToIncomeDashboard', 'Lihat Income')}
                                </Button>
                              </Link>
                            </div>
                            <div className="text-left sm:text-right min-w-0 flex-shrink-0">
                              <div className="text-2xl sm:text-3xl font-bold text-white truncate">
                                {balancesLoading ? t('expenses.loading', 'Loading...') : formatToRupiah(
                                  bankAccountBalances.reduce((total, b) => total + (b.balance ?? 0), 0)
                                )}
                              </div>
                              <div className="text-xs text-white/80 truncate mt-1">
                                {bankAccounts.length} bank account{bankAccounts.length !== 1 ? 's' : ''} registered
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="min-w-0 shrink-0">
                      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Card className="min-w-0">
                          <CardContent className="p-3 min-w-0">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{t('debt.totalDebt', 'Total Debt')}</div>
                            <div
                              className="text-xl sm:text-2xl font-bold mb-1 truncate text-brand-blue"
                              style={{ color: 'hsl(var(--brand-blue))' }}
                            >
                              {formatToRupiah(totalDebt)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {debts.length} {t('debt.debts', 'debts')}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="min-w-0">
                          <CardContent className="p-3 min-w-0">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{t('debt.totalLimit', 'Total Limit')}</div>
                            <div className="text-xl sm:text-2xl font-bold mb-1 truncate">
                              {formatToRupiah(totalLimit)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {t('debt.totalPlafon', 'Total limit')}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="min-w-0">
                          <CardContent className="p-3 min-w-0">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{t('debt.activeDebt', 'Active Debt')}</div>
                            <div
                              className="text-xl sm:text-2xl font-bold mb-1 truncate text-brand-blue"
                              style={{ color: 'hsl(var(--brand-blue))' }}
                            >
                              {formatToRupiah(activeDebtTotal)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {activeDebts.length} {t('debt.activeDebts', 'active debts')}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="min-w-0">
                          <CardContent className="p-3 min-w-0">
                            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{t('debt.totalInterestYtd', 'Total Interest YTD')}</div>
                            <div className="text-xl sm:text-2xl font-bold mb-1 truncate text-brand-blue">
                              {formatToRupiah(totalInterestYtd)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {new Date().getFullYear()}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                      <DebtTable
                        debts={debts}
                        isLoading={isLoading}
                        onAdd={handleAddClick}
                        onPayDebt={handlePayDebt}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onViewDetails={handleViewDetails}
                        onPaidClick={setPaymentHistoryDebt}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </div>
              <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
            </div>
          </div>
        </div>
      </div>
      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
        >
          <DebtPageSkeleton />
        </div>
      ) : null}

      {/* Add/Edit Form */}
      <DebtForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={editingDebt || undefined}
        isLoading={isCreating || isUpdating}
      />

      {/* Payment Modal */}
      <DebtPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={handlePaymentClose}
        onSubmit={handlePaymentSubmit}
        debts={debts}
        isLoading={isUpdating}
      />

      {/* Payment History Modal */}
      <DebtPaymentHistoryModal
        debt={paymentHistoryDebt}
        isOpen={!!paymentHistoryDebt}
        onClose={() => setPaymentHistoryDebt(null)}
        onPaymentDeleted={() => void refetchDebts()}
      />

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto min-w-0">
          <DialogHeader>
            <DialogTitle>{t('debt.detail.title', 'Debt Details')}</DialogTitle>
            <DialogDescription>
              {t('debt.detail.description', 'Complete information about this debt')}
            </DialogDescription>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.table.debtName', 'Debt Name')}</label>
                  <p className="text-sm font-semibold mt-1">{selectedDebt.debt_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.table.type', 'Type')}</label>
                  <p className="text-sm mt-1">{selectedDebt.debt_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.table.bankInstitution', 'Bank/Institution')}</label>
                  <p className="text-sm mt-1">{selectedDebt.bank_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.table.status', 'Status')}</label>
                  <p className="text-sm mt-1">
                    {selectedDebt.status === 'active' ? t('debt.status.active', 'Active') : 
                     selectedDebt.status === 'paid_off' ? t('debt.status.paidOff', 'Paid Off') : t('debt.status.closed', 'Closed')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.table.totalLimit', 'Total Limit')}</label>
                  <p className="text-sm font-semibold mt-1">{formatToRupiah(selectedDebt.limit_amount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.table.debt', 'Debt')}</label>
                  <p className="text-sm font-bold mt-1 text-brand-red">
                    {formatToRupiah(resolveDebtDisplay(selectedDebt).displayDebtAmount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.table.utilization', 'Utilization')}</label>
                  <p className="text-sm mt-1">
                    {resolveDebtDisplay(selectedDebt).utilization}%
                  </p>
                </div>
                {selectedDebt.interest_rate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('debt.detail.interest', 'Interest')}</label>
                    <p className="text-sm mt-1">{selectedDebt.interest_rate} {t('debt.detail.interestPerYear', '% per year')}</p>
                  </div>
                )}
                {selectedDebt.due_date && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('debt.table.dueDate', 'Due Date')}</label>
                    <p className="text-sm mt-1">
                      {new Date(selectedDebt.due_date).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                )}
                {selectedDebt.minimum_payment && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('debt.form.minimumPayment', 'Minimum Payment (Rp)')}</label>
                    <p className="text-sm mt-1">{formatToRupiah(selectedDebt.minimum_payment)}</p>
                  </div>
                )}
              </div>
              {selectedDebt.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.form.description', 'Description')}</label>
                  <p className="text-sm mt-1">{selectedDebt.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.detail.created', 'Created')}</label>
                  <p className="text-sm mt-1">
                    {new Date(selectedDebt.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('debt.detail.updated', 'Updated')}</label>
                  <p className="text-sm mt-1">
                    {new Date(selectedDebt.updated_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtPage;
