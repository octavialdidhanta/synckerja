
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { format } from 'date-fns';
import { PurchaseRequest, useUpdatePurchaseRequestStatus } from '@/9-request-form/hooks/usePurchaseRequests';
import { useExpenseTypes } from '@/shared/hooks/finance/useExpenseTypes';
import { useExpenseCategories } from '@/shared/hooks/finance/useExpenseCategories';
import { useDebtsForExpense } from '@/shared/hooks/finance/useDebtsForExpense';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import { Calendar, User, Building, DollarSign, FileText, Target, Zap, TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import { PurchaseRequestPDFViewer } from './PurchaseRequestPDFViewer';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';

interface PurchaseRequestDetailsModalProps {
  request: PurchaseRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseRequestDetailsModal = ({ request, isOpen, onClose }: PurchaseRequestDetailsModalProps) => {
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>(request?.expense_type_id || '');
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState<string>(request?.expense_category_id || '');
  const [selectedWithdrawalFromBalance, setSelectedWithdrawalFromBalance] = useState<string | undefined>(request?.withdrawal_from_balance);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | undefined>(request?.bank_account_id);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionTextarea, setShowRejectionTextarea] = useState(false);

  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories } = useExpenseCategories(selectedExpenseTypeId);
  const { debts: debtsForExpense, isLoading: debtsLoading } = useDebtsForExpense();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const { balances: bankAccountBalances, loading: balancesLoading } = useBankAccountBalances();
  const { data: userRole } = useCurrentUserRole();
  const { t } = useAppTranslation();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (request?.expense_type_id) {
      setSelectedExpenseTypeId(request.expense_type_id);
    }
    if (request?.expense_category_id) {
      setSelectedExpenseCategoryId(request.expense_category_id);
    }
    setSelectedWithdrawalFromBalance(request?.withdrawal_from_balance);
    setSelectedBankAccountId(request?.bank_account_id);
  }, [request?.expense_type_id, request?.expense_category_id, request?.withdrawal_from_balance, request?.bank_account_id]);

  // Reset category when expense type changes
  useEffect(() => {
    setSelectedExpenseCategoryId('');
  }, [selectedExpenseTypeId]);

  if (!request) return null;

  const normalizedUserRole = typeof userRole === 'string' ? userRole : null;
  const canApprove = !!normalizedUserRole && ['owner', 'admin', 'hr'].includes(normalizedUserRole);
  const canTakeAction = canApprove && (request.status === 'submitted' || request.status === 'pending_approval');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending_approval':
      case 'submitted':
        return <Badge className="bg-brand-blue/10 text-brand-blue">Pending Approval</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const handleApprove = async () => {
    if (!selectedExpenseTypeId) {
      toast({
        title: "Expense Type Required",
        description: "Please select an expense type.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedExpenseCategoryId) {
      toast({
        title: "Expense Category Required",
        description: "Please select an expense category.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: 'approved',
        approvalNotes: approvalNotes,
        expenseTypeId: selectedExpenseTypeId,
        expenseCategoryId: selectedExpenseCategoryId,
        withdrawalFromBalance: selectedWithdrawalFromBalance,
        bankAccountId: selectedBankAccountId,
      });
      toast({
        title: "Request Approved",
        description: "Purchase request has been approved successfully.",
      });
      onClose();
      setApprovalNotes('');
      setSelectedExpenseTypeId('');
      setSelectedExpenseCategoryId('');
      setSelectedWithdrawalFromBalance(undefined);
      setSelectedBankAccountId(undefined);
    } catch (error) {
      console.error('Approval error:', error);
      toast({
        title: "Error",
        description: "Failed to approve request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: 'rejected',
        rejectionReason: rejectionReason
      });
      toast({
        title: "Request Rejected",
        description: "Purchase request has been rejected.",
      });
      onClose();
      setRejectionReason('');
      setShowRejectionTextarea(false);
    } catch (error) {
      console.error('Rejection error:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={
          isMobile
            ? "modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0"
            : "max-w-4xl max-h-[85vh] flex flex-col"
        }
        fullscreenAnimation={isMobile}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Request Details</span>
            {getStatusBadge(request.status)}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detail</TabsTrigger>
            <TabsTrigger value="pdf">PDF</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 seamless-scroll">
            <div className="space-y-4">
          {/* Basic Information */}
          <Card className="border-slate-200">
            <CardHeader className="px-4 py-3 pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5">
                  <FileText className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Title</p>
                    <p className="font-medium text-slate-900 break-words">{request.request_title}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Amount</p>
                    <p className="font-medium text-slate-900">{formatToRupiah(request.amount_idr)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Requester</p>
                    <p className="font-medium text-slate-900 break-words">{request.requester_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Department</p>
                    <p className="font-medium text-slate-900">{request.department_name || 'Not specified'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Created</p>
                    <p className="font-medium text-slate-900">{format(new Date(request.created_at), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                {request.is_recurring && (
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 mb-1">Frequency</p>
                      <p className="font-medium text-purple-600">{request.recurring_frequency}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card className="border-slate-200">
            <CardHeader className="px-4 py-3 pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <p className="text-slate-700 whitespace-pre-wrap">
                {request.description || 'No description provided'}
              </p>
            </CardContent>
          </Card>

          {/* Business Impact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Company Benefit
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {request.company_benefit || 'Not specified'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Expected Outcome
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {request.expected_outcome || 'Not specified'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Purchase Details */}
          {request.request_type === 'purchase' && (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Purchase Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="space-y-3">
                  {request.vendor_name && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Vendor</p>
                      <p className="font-medium text-slate-900">{request.vendor_name}</p>
                    </div>
                  )}
                  {request.purchase_link && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Purchase Link</p>
                      <a 
                        href={request.purchase_link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-brand-blue hover:text-brand-blue/90 hover:underline text-sm break-all"
                      >
                        {request.purchase_link}
                      </a>
                    </div>
                  )}
                  {request.purchase_type && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Type</p>
                      <p className="font-medium text-slate-900">{request.purchase_type}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reimbursement Details */}
          {request.request_type === 'reimbursement' && (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Reimbursement Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="space-y-3">
                {request.reimbursement_type && (
                  <div>
                    <p className="text-xs text-slate-600">Type</p>
                    <p className="font-medium">{request.reimbursement_type}</p>
                  </div>
                )}
                {request.merchant_name && (
                  <div>
                    <p className="text-xs text-slate-600">Merchant</p>
                    <p className="font-medium">{request.merchant_name}</p>
                  </div>
                )}
                {request.receipt_number && (
                  <div>
                    <p className="text-xs text-slate-600">Receipt Number</p>
                    <p className="font-medium">{request.receipt_number}</p>
                  </div>
                )}
                {request.expense_date && (
                  <div>
                    <p className="text-xs text-slate-600">Expense Date</p>
                    <p className="font-medium">{format(new Date(request.expense_date), 'MMM dd, yyyy')}</p>
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval Information */}
          {(request.status === 'approved' || request.status === 'rejected') && (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Approval Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="space-y-2.5">
                {request.approved_by_name && (
                  <div>
                    <p className="text-xs text-slate-600">Approved By</p>
                    <p className="font-medium">{request.approved_by_name}</p>
                  </div>
                )}
                {request.rejected_by_name && (
                  <div>
                    <p className="text-xs text-slate-600">Rejected By</p>
                    <p className="font-medium">{request.rejected_by_name}</p>
                  </div>
                )}
                {request.approved_at && (
                  <div>
                    <p className="text-xs text-slate-600">Date</p>
                    <p className="font-medium">{format(new Date(request.approved_at), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                )}
                {request.rejected_at && (
                  <div>
                    <p className="text-xs text-slate-600">Date</p>
                    <p className="font-medium">{format(new Date(request.rejected_at), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                )}
                {request.rejection_reason && (
                  <div>
                    <p className="text-xs text-slate-600">Rejection Reason</p>
                    <p className="font-medium text-brand-red">{request.rejection_reason}</p>
                  </div>
                )}
                {request.approval_notes && (
                  <div>
                    <p className="text-xs text-slate-600">Notes</p>
                    <p className="font-medium">{request.approval_notes}</p>
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Section */}
          {canTakeAction && (
            <>
              <Separator className="my-6" />
              
              {/* Expense Classification */}
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Expense Classification
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="expense-type" className="text-sm font-medium">
                        Expense Type <span className="text-brand-red">*</span>
                      </Label>
                      <Select
                        value={selectedExpenseTypeId}
                        onValueChange={setSelectedExpenseTypeId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select expense type" />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedExpenseTypeId && (
                      <div className="space-y-2">
                        <Label htmlFor="expense-category" className="text-sm font-medium">
                          Expense Category <span className="text-brand-red">*</span>
                        </Label>
                        <Select
                          value={selectedExpenseCategoryId}
                          onValueChange={setSelectedExpenseCategoryId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select expense category" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.length > 0 ? (
                              expenseCategories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-categories" disabled>
                                No categories available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Withdrawal From Balance (optional at approval) */}
                  <div className="space-y-2">
                    <Label htmlFor="withdrawal-from-balance" className="text-sm font-medium">
                      {t('expenses.withdrawalFromBalanceOptional', 'Withdrawal From Balance (Optional)')}
                    </Label>
                    <Select
                      value={
                        selectedWithdrawalFromBalance
                          ? `debt_${selectedWithdrawalFromBalance}`
                          : selectedBankAccountId
                            ? `bank_${selectedBankAccountId}`
                            : 'none'
                      }
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setSelectedWithdrawalFromBalance(undefined);
                          setSelectedBankAccountId(undefined);
                        } else if (value.startsWith('debt_')) {
                          setSelectedWithdrawalFromBalance(value.replace('debt_', ''));
                          setSelectedBankAccountId(undefined);
                        } else if (value.startsWith('bank_')) {
                          setSelectedBankAccountId(value.replace('bank_', ''));
                          setSelectedWithdrawalFromBalance(undefined);
                        }
                      }}
                      disabled={debtsLoading || bankAccountsLoading || balancesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={(debtsLoading || bankAccountsLoading) ? t('expenses.loading', 'Loading...') : t('expenses.selectSourceOptional', 'Select Source (Optional)')}>
                          {selectedWithdrawalFromBalance
                            ? (() => {
                                const debt = debtsForExpense.find(d => d.id === selectedWithdrawalFromBalance);
                                if (debt) {
                                  const availableLimit = debt.available_limit ?? 0;
                                  return `${debt.debt_name} (Rp ${availableLimit.toLocaleString('id-ID')} available)`;
                                }
                                return '';
                              })()
                            : selectedBankAccountId
                              ? (() => {
                                  const bank = bankAccounts.find(b => b.id === selectedBankAccountId);
                                  if (bank) {
                                    const balance = bankAccountBalances.find(b => b.bank_account_id === bank.id);
                                    const availableBalance = balance?.balance ?? 0;
                                    return bank.account_number
                                      ? `${bank.name} - ${bank.account_number} (Rp ${availableBalance.toLocaleString('id-ID')} available)`
                                      : `${bank.name} (Rp ${availableBalance.toLocaleString('id-ID')} available)`;
                                  }
                                  return '';
                                })()
                              : ''}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('expenses.none', 'None')}</SelectItem>
                        {bankAccounts.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t('expenses.bankAccounts', 'Bank Accounts')}</div>
                            {bankAccounts.map((bankAccount) => {
                              const balance = bankAccountBalances.find(b => b.bank_account_id === bankAccount.id);
                              const availableBalance = balance?.balance ?? 0;
                              const displayText = bankAccount.account_number
                                ? `${bankAccount.name} - ${bankAccount.account_number} (Rp ${availableBalance.toLocaleString('id-ID')} available)`
                                : `${bankAccount.name} (Rp ${availableBalance.toLocaleString('id-ID')} available)`;
                              return (
                                <SelectItem key={`bank_${bankAccount.id}`} value={`bank_${bankAccount.id}`}>
                                  {displayText}
                                </SelectItem>
                              );
                            })}
                          </>
                        )}
                        {debtsForExpense.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t('expenses.debts', 'Debts')}</div>
                            {debtsForExpense.map((debt) => {
                              const availableLimit = debt.available_limit ?? 0;
                              return (
                                <SelectItem key={`debt_${debt.id}`} value={`debt_${debt.id}`}>
                                  {debt.debt_name} (Rp {availableLimit.toLocaleString('id-ID')} available)
                                </SelectItem>
                              );
                            })}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Approval Notes */}
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Approval Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-3 space-y-3">
                  {!showRejectionTextarea ? (
                    <div className="space-y-2">
                      <Label htmlFor="approval-notes" className="text-sm font-medium">
                        Approval Notes <span className="text-slate-500 text-xs font-normal">(Optional)</span>
                      </Label>
                      <Textarea
                        id="approval-notes"
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add any notes or comments for this approval..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="rejection-reason" className="text-sm font-medium">
                        Rejection Reason <span className="text-brand-red">*</span>
                      </Label>
                      <Textarea
                        id="rejection-reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Please provide a clear reason for rejecting this request..."
                        rows={3}
                        className="resize-none"
                        required
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-2.5 justify-end pt-2">
                {!showRejectionTextarea ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRejectionTextarea(true)}
                      className="text-brand-red border-brand-red/30 hover:bg-brand-red/10 hover:border-brand-red/50"
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      onClick={handleApprove}
                      disabled={updateStatus.isPending || !selectedExpenseTypeId || !selectedExpenseCategoryId}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      {updateStatus.isPending ? 'Approving...' : 'Approve'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowRejectionTextarea(false);
                        setRejectionReason('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleReject}
                      disabled={updateStatus.isPending || !rejectionReason.trim()}
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      {updateStatus.isPending ? 'Rejecting...' : 'Confirm Reject'}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
            </div>
          </TabsContent>

          <TabsContent value="pdf" className="flex-1 overflow-hidden mt-4">
            <div className="h-full min-h-[600px]">
              <PurchaseRequestPDFViewer request={request} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
