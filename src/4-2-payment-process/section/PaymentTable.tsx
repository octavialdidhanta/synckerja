import { useState, useRef, useEffect } from 'react';
import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { useUpdatePurchaseRequestStatus } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { CreditCard, User, Building, Calendar, FileText, DollarSign, Target, Zap, TrendingUp, Upload, X, CheckCircle, Lock, Key } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import { useExpenses } from '@/shared/hooks/finance/useExpenses';
import { useDebtsForExpense } from '@/shared/hooks/finance/useDebtsForExpense';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';

interface PaymentTableProps {
  requests: PurchaseRequest[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const PaymentTable = ({ 
  requests, 
  isLoading = false,
  onRefresh 
}: PaymentTableProps) => {
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [processWithdrawalFromBalance, setProcessWithdrawalFromBalance] = useState<string | undefined>(undefined);
  const [processBankAccountId, setProcessBankAccountId] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const { createExpense, isCreating: isCreatingExpense } = useExpenses();
  const { debts: debtsForExpense, isLoading: debtsLoading } = useDebtsForExpense();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const { balances: bankAccountBalances, loading: balancesLoading } = useBankAccountBalances();

  // Sync withdrawal source from request when modal opens or request changes
  useEffect(() => {
    if (selectedRequest) {
      setProcessWithdrawalFromBalance(selectedRequest.withdrawal_from_balance);
      setProcessBankAccountId(selectedRequest.bank_account_id);
    }
  }, [selectedRequest?.id, selectedRequest?.withdrawal_from_balance, selectedRequest?.bank_account_id]);

  // Filter only approved requests (include both paid and unpaid for history)
  const paymentRequests = requests.filter(req => req.status === 'approved');

  const getStatusBadge = (request: PurchaseRequest) => {
    if (request.paid_at || request.payment_status === 'paid') {
      return (
        <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
          Paid
        </Badge>
      );
    }
    if (request.payment_status === 'processing') {
      return (
        <Badge className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded-full">
          Processing
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
        Pending
      </Badge>
    );
  };

  const getTypeDisplay = (request: PurchaseRequest) => {
    if (request.request_type === 'reimbursement') {
      return request.reimbursement_type || 'Reimbursement';
    }
    return request.purchase_type || 'Purchase';
  };

  const handleViewDetails = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setInvoiceFile(null);
    setProcessWithdrawalFromBalance(request.withdrawal_from_balance);
    setProcessBankAccountId(request.bank_account_id);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type (allow PDF, images, etc.)
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF or image file (JPEG, PNG, GIF).",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setInvoiceFile(file);
    }
  };

  const handleUploadInvoice = async () => {
    if (!selectedRequest || !organizationId || !user) {
      return;
    }

    // Need either a new invoice file or an existing invoice path (retry after partial failure)
    const hasInvoice = !!invoiceFile || !!selectedRequest.invoice_file_path;
    if (!selectedRequest.paid_at && !hasInvoice) {
      toast({
        title: "Invoice required",
        description: "Please select an invoice file to upload.",
        variant: "destructive",
      });
      return;
    }

    // Required: must select funding source before Process (for unpaid requests)
    if (!selectedRequest.paid_at && !processWithdrawalFromBalance && !processBankAccountId) {
      toast({
        title: t('expenses.withdrawalFromBalanceRequired'),
        description: t('expenses.withdrawalRequiredToast'),
        variant: "destructive",
      });
      return;
    }

    const expenseTypeName = selectedRequest.expense_types?.name ?? '';
    const expenseCategoryName = selectedRequest.expense_categories?.name ?? '';
    if (!expenseTypeName || !expenseCategoryName) {
      toast({
        title: "Error",
        description: "Request is missing expense type or category. Please ensure the request was approved with type and category.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingInvoice(true);
    try {
      let fileName: string;

      if (selectedRequest.invoice_file_path) {
        // Retry: invoice already saved from previous attempt; reuse path
        fileName = selectedRequest.invoice_file_path;
      } else if (invoiceFile) {
        // Step 1: Upload invoice first (no DB change yet)
        const timestamp = Date.now();
        fileName = `invoices/${organizationId}/${selectedRequest.id}/${timestamp}-${invoiceFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const { error: uploadError } = await supabase.storage
          .from('purchase-documents')
          .upload(fileName, invoiceFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }
      } else {
        setIsUploadingInvoice(false);
        return;
      }

      // Step 2: Update request with invoice path and funding source (do NOT mark as paid yet)
      await updateStatus.mutateAsync({
        id: selectedRequest.id,
        status: selectedRequest.status,
        invoiceFilePath: fileName,
        withdrawalFromBalance: processWithdrawalFromBalance,
        bankAccountId: processBankAccountId,
        markAsPaid: false,
      });

      // Step 3: Avoid double expense – check if expense already exists for this request
      const { data: existingExpense } = await supabase
        .from('expenses')
        .select('id')
        .eq('purchase_request_id', selectedRequest.id)
        .maybeSingle();

      let expenseCreated: { id: string } | null = null;
      if (!existingExpense) {
        // Step 4: Create expense (balance deducted via triggers / updateBalance)
        const created = await createExpense({
          expense_name: selectedRequest.request_title,
          amount: selectedRequest.amount_idr,
          expense_type: expenseTypeName,
          category: expenseCategoryName,
          department: selectedRequest.department_name ?? undefined,
          create_date: format(new Date(), 'yyyy-MM-dd'),
          is_recurring: false,
          description: selectedRequest.description ?? undefined,
          withdrawal_from_balance: processWithdrawalFromBalance,
          bank_account_id: processBankAccountId,
          purchase_request_id: selectedRequest.id,
        });

        if (!created) {
          toast({
            title: "Expense creation failed",
            description: "Invoice was saved. You can retry processing; expense will not be created twice.",
            variant: "destructive",
          });
          if (onRefresh) onRefresh();
          setIsUploadingInvoice(false);
          return;
        }
        expenseCreated = created;
      }

      const expenseId = expenseCreated?.id ?? existingExpense?.id;
      // Step 4b: For Physical Item, create one company_assets row per unit (no quantity column)
      if (
        selectedRequest.purchase_type === 'Physical Item' &&
        expenseId &&
        organizationId
      ) {
        const { data: existingAssets } = await supabase
          .from('company_assets')
          .select('id')
          .eq('purchase_request_id', selectedRequest.id);
        if (!existingAssets?.length) {
          const qty = Math.max(1, selectedRequest.quantity ?? 1);
          const pricePerUnit = selectedRequest.amount_idr / qty;
          const createDate = format(new Date(), 'yyyy-MM-dd');
          const rows = Array.from({ length: qty }, (_, i) => ({
            organization_id: organizationId,
            name: `${selectedRequest.request_title} – ${i + 1}`,
            type: 'other',
            status: 'available',
            purchase_request_id: selectedRequest.id,
            expense_id: expenseId,
            receipt_confirmed_at: null,
            purchase_date: createDate,
            purchase_price: pricePerUnit,
            created_by: user?.id ?? null,
          }));
          const { error: assetsError } = await supabase.from('company_assets').insert(rows);
          if (assetsError) {
            console.error('Failed to create company assets:', assetsError);
            toast({
              title: "Assets creation warning",
              description: "Expense and payment recorded, but company assets could not be created. You can add them manually.",
              variant: "destructive",
            });
          }
        }
      }

      // Step 5: Mark request as paid (idempotent; safe if step 4 was skipped due to existing expense)
      try {
        await updateStatus.mutateAsync({
          id: selectedRequest.id,
          status: selectedRequest.status,
          markAsPaid: true,
        });
      } catch (markPaidError: any) {
        // Expense already created and balance deducted; only marking paid failed
        console.error('Failed to mark request as paid:', markPaidError);
        toast({
          title: "Partially complete",
          description: "Expense and balance were updated, but failed to mark request as paid. Please refresh the page.",
          variant: "destructive",
        });
        if (onRefresh) onRefresh();
        setIsUploadingInvoice(false);
        return;
      }

      toast({
        title: "Success",
        description: "Payment processed. Invoice saved, expense recorded, and balance updated.",
      });

      setInvoiceFile(null);
      setProcessWithdrawalFromBalance(undefined);
      setProcessBankAccountId(undefined);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsModalOpen(false);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process payment. You can retry; duplicate expense will not be created.",
        variant: "destructive",
      });
      if (onRefresh) onRefresh();
    } finally {
      setIsUploadingInvoice(false);
    }
  };

  const handleRemoveFile = () => {
    setInvoiceFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleViewInvoice = async (e: React.MouseEvent, filePath: string) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.storage
        .from('purchase-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error);
        toast({
          title: "Error",
          description: "Failed to generate invoice URL. Please try again.",
          variant: "destructive",
        });
        return;
      }

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Error viewing invoice:', error);
      toast({
        title: "Error",
        description: "Failed to open invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted/60 rounded w-1/4"></div>
          <div className="h-10 bg-muted/60 rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/60 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">Payment Requests</h2>
      </div>

      {/* Horizontal scroll only; vertikal mengikuti scroll halaman */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[1400px] caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
            <TableRow className="border-b bg-card">
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Request</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Requester</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Department</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Amount</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Type</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Status</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Recurring</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Approval Date</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Paid Date</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Paid By</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium w-16 whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-16 text-center">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-1">No payment requests found</p>
                  <p className="text-xs text-gray-400">Approved requests will appear here</p>
                </TableCell>
              </TableRow>
            ) : (
              paymentRequests.map((request) => (
                <TableRow key={request.id} className="hover:bg-muted/40">
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-brand-blue/10 flex-shrink-0">
                        <CreditCard className="h-3.5 w-3.5 text-brand-blue" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">
                          {request.request_title}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {request.description || 'No description'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-muted/40">
                        <User className="h-3 w-3 text-gray-600" />
                      </div>
                      <span className="font-medium text-gray-700">{request.requester_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-muted/40">
                        <Building className="h-3 w-3 text-gray-600" />
                      </div>
                      <span>{request.department_name || 'Not specified'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="font-bold text-gray-900">{formatToRupiah(request.amount_idr)}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {getTypeDisplay(request)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {getStatusBadge(request)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs whitespace-nowrap">
                    <Badge variant={request.is_recurring ? 'default' : 'secondary'}>
                      {request.is_recurring ? 'Recurring' : 'One-time'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    {request.approved_at ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-muted/40">
                          <Calendar className="h-3 w-3 text-gray-600" />
                        </div>
                        <span>{format(new Date(request.approved_at), 'MMM dd, yyyy')}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    {request.paid_at ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-muted/40">
                          <Calendar className="h-3 w-3 text-gray-600" />
                        </div>
                        <span>{format(new Date(request.paid_at), 'MMM dd, yyyy')}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    {request.paid_by_name ? (
                      <span className="font-medium">{request.paid_by_name}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <button
                      onClick={() => handleViewDetails(request)}
                      className="text-brand-blue hover:text-brand-blue-deep text-xs font-medium"
                    >
                      View
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>

      {/* Payment Request Detail Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Payment Request Details</span>
              {selectedRequest && getStatusBadge(selectedRequest)}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
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
                        <p className="font-medium text-slate-900 break-words">{selectedRequest.request_title}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <DollarSign className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-1">Amount</p>
                        <p className="font-medium text-slate-900">{formatToRupiah(selectedRequest.amount_idr)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <User className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-1">Requester</p>
                        <p className="font-medium text-slate-900 break-words">{selectedRequest.requester_name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Building className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-1">Department</p>
                        <p className="font-medium text-slate-900">{selectedRequest.department_name || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Calendar className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-1">Approved Date</p>
                        <p className="font-medium text-slate-900">
                          {format(new Date(selectedRequest.approved_at || selectedRequest.created_at || ''), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CreditCard className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-1">Type</p>
                        <p className="font-medium text-slate-900">
                          {selectedRequest.request_type === 'reimbursement' 
                            ? selectedRequest.reimbursement_type || 'Reimbursement'
                            : selectedRequest.purchase_type || 'Purchase'}
                        </p>
                      </div>
                    </div>
                    {selectedRequest.is_recurring && (
                      <div className="flex items-start gap-2.5">
                        <TrendingUp className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500 mb-1">Frequency</p>
                          <p className="font-medium text-purple-600">{selectedRequest.recurring_frequency}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Account Information */}
              {(selectedRequest.account_username || selectedRequest.account_password) && (
                <Card className="border-slate-200">
                  <CardHeader className="px-4 py-3 pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Account Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedRequest.account_username && (
                        <div className="flex items-start gap-2.5">
                          <User className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 mb-1">Username/Email</p>
                            <p className="font-medium text-slate-900 break-words">
                              {selectedRequest.account_username}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedRequest.account_password && (
                        <div className="flex items-start gap-2.5">
                          <Lock className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 mb-1">Account Password</p>
                            <p className="font-medium text-slate-900 break-words">
                              {selectedRequest.account_password}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Description */}
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-3">
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {selectedRequest.description || 'No description provided'}
                  </p>
                </CardContent>
              </Card>

              {/* Expected Outcome */}
              {selectedRequest.expected_outcome && (
                <Card className="border-slate-200">
                  <CardHeader className="px-4 py-3 pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Expected Outcome
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    <p className="text-slate-700 whitespace-pre-wrap">
                      {selectedRequest.expected_outcome}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Purchase Details */}
              {selectedRequest.request_type === 'purchase' && (selectedRequest.vendor_name || selectedRequest.purchase_link || selectedRequest.purchase_type) && (
                <Card className="border-slate-200">
                  <CardHeader className="px-4 py-3 pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Purchase Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    <div className="space-y-3">
                      {selectedRequest.vendor_name && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Vendor</p>
                          <p className="font-medium text-slate-900">{selectedRequest.vendor_name}</p>
                        </div>
                      )}
                      {selectedRequest.purchase_link && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Purchase Link</p>
                          <a
                            href={selectedRequest.purchase_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-blue hover:text-brand-blue-deep hover:underline text-sm break-all"
                          >
                            {selectedRequest.purchase_link}
                          </a>
                        </div>
                      )}
                      {selectedRequest.purchase_type && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Type</p>
                          <p className="font-medium text-slate-900">{selectedRequest.purchase_type}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reimbursement Details */}
              {selectedRequest.request_type === 'reimbursement' && (
                <Card className="border-slate-200">
                  <CardHeader className="px-4 py-3 pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Reimbursement Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    <div className="space-y-3">
                      {selectedRequest.reimbursement_type && (
                        <div>
                          <p className="text-xs text-slate-600">Type</p>
                          <p className="font-medium">{selectedRequest.reimbursement_type}</p>
                        </div>
                      )}
                      {selectedRequest.merchant_name && (
                        <div>
                          <p className="text-xs text-slate-600">Merchant</p>
                          <p className="font-medium">{selectedRequest.merchant_name}</p>
                        </div>
                      )}
                      {selectedRequest.receipt_number && (
                        <div>
                          <p className="text-xs text-slate-600">Receipt Number</p>
                          <p className="font-medium">{selectedRequest.receipt_number}</p>
                        </div>
                      )}
                      {selectedRequest.expense_date && (
                        <div>
                          <p className="text-xs text-slate-600">Expense Date</p>
                          <p className="font-medium">{format(new Date(selectedRequest.expense_date), 'MMM dd, yyyy')}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Information */}
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-3">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Payment Status</p>
                      {getStatusBadge(selectedRequest)}
                    </div>
                    {selectedRequest.paid_at && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Paid Date</p>
                        <p className="font-medium text-slate-900">
                          {format(new Date(selectedRequest.paid_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                    {selectedRequest.invoice_file_path && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Invoice</p>
                        <a
                          href="#"
                          onClick={(e) => handleViewInvoice(e, selectedRequest.invoice_file_path!)}
                          className="text-brand-blue hover:text-brand-blue-deep hover:underline text-sm flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                          View Invoice
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Upload Section */}
              {!selectedRequest.paid_at && (
                <>
                  <Separator className="my-4" />

                  {/* Withdrawal From Balance (required before Process) */}
                  <Card className="border-slate-200">
                    <CardHeader className="px-4 py-3 pb-2">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        {t('expenses.withdrawalFromBalanceRequired')} <span className="text-brand-red">*</span>
                      </CardTitle>
                      <p className="text-xs text-slate-500 font-normal mt-1">
                        {t('expenses.paymentProcessWithdrawalHint')}
                      </p>
                    </CardHeader>
                    <CardContent className="px-4 py-3 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="process-withdrawal" className="text-sm font-medium">
                          {t('expenses.fundingSource')} <span className="text-brand-red">*</span>
                        </Label>
                        <Select
                          value={
                            processWithdrawalFromBalance
                              ? `debt_${processWithdrawalFromBalance}`
                              : processBankAccountId
                                ? `bank_${processBankAccountId}`
                                : 'none'
                          }
                          onValueChange={(value) => {
                            if (value === 'none') {
                              setProcessWithdrawalFromBalance(undefined);
                              setProcessBankAccountId(undefined);
                            } else if (value.startsWith('debt_')) {
                              setProcessWithdrawalFromBalance(value.replace('debt_', ''));
                              setProcessBankAccountId(undefined);
                            } else if (value.startsWith('bank_')) {
                              setProcessBankAccountId(value.replace('bank_', ''));
                              setProcessWithdrawalFromBalance(undefined);
                            }
                          }}
                          disabled={debtsLoading || bankAccountsLoading || balancesLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={(debtsLoading || bankAccountsLoading) ? t('expenses.loading') : t('expenses.selectSourceRequired')}>
                              {processWithdrawalFromBalance
                                ? (() => {
                                    const debt = debtsForExpense.find(d => d.id === processWithdrawalFromBalance);
                                    if (debt) {
                                      const availableLimit = debt.available_limit ?? 0;
                                      return `${debt.debt_name} (Rp ${availableLimit.toLocaleString('id-ID')} available)`;
                                    }
                                    return '';
                                  })()
                                : processBankAccountId
                                  ? (() => {
                                      const bank = bankAccounts.find(b => b.id === processBankAccountId);
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
                            <SelectItem value="none">{t('expenses.none')}</SelectItem>
                            {bankAccounts.length > 0 && (
                              <>
                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t('expenses.bankAccounts')}</div>
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
                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t('expenses.debts')}</div>
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
                  
                  <Card className="border-slate-200">
                    <CardHeader className="px-4 py-3 pb-2">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Upload Invoice
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-3 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="invoice-file" className="text-sm font-medium">
                          Invoice File <span className="text-brand-red">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            ref={fileInputRef}
                            id="invoice-file"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.gif"
                            onChange={handleFileSelect}
                            className="flex-1"
                          />
                          {invoiceFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveFile}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {invoiceFile && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <FileText className="h-4 w-4" />
                            <span className="flex-1 truncate">{invoiceFile.name}</span>
                            <span className="text-xs text-slate-500">
                              {(invoiceFile.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-slate-500">
                          Supported formats: PDF, JPEG, PNG, GIF (Max 10MB)
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleUploadInvoice}
                        disabled={
                          (!invoiceFile && !selectedRequest?.invoice_file_path) ||
                          isUploadingInvoice ||
                          updateStatus.isPending ||
                          isCreatingExpense ||
                          (!processWithdrawalFromBalance && !processBankAccountId)
                        }
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isUploadingInvoice || updateStatus.isPending || isCreatingExpense ? (
                          <>
                            <Upload className="mr-2 h-4 w-4 animate-pulse" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Upload Invoice & Mark as Paid
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
