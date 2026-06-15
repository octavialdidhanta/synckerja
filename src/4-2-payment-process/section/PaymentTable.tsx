import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { useUpdatePurchaseRequestStatus } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { CreditCard, User, Building, Calendar, FileText, DollarSign, Target, Zap, TrendingUp, Upload, X, CheckCircle, Lock, Key } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import { useExpenses } from '@/shared/hooks/finance/useExpenses';
import {
  hasWithdrawalSource,
  type WithdrawalSourceValue,
} from '@/shared/lib/finance/withdrawalSourceValue';
import { openSupabaseSignedFile } from '@/shared/utils/openSupabaseSignedFile';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { PaymentExpenseClassificationCard } from '@/4-2-payment-process/components/PaymentExpenseClassificationCard';
import {
  PaymentGatewayVendorBankCard,
  type GatewayVendorBankFields,
} from '@/4-2-payment-process/components/PaymentGatewayVendorBankCard';
import { executeXenditDisbursement, fetchXenditWalletBalance, pollXenditDisbursements } from '@/xendit/lib/xenditApi';
import { executeBrickDisbursement } from '@/4-1-transaction/lib/brickBankApi';
import { useXenditOrgSettings } from '@/xendit/hooks/useXenditOrgSettings';
import { BRICK_SANDBOX_DISBURSE_ACCOUNT } from '@/4-1-transaction/hooks/useBrickLinkedAccounts';
import { useExpenseTypes } from '@/shared/hooks/finance/useExpenseTypes';
import { useExpenseCategories } from '@/shared/hooks/finance/useExpenseCategories';
import { useDebtsForExpense } from '@/shared/hooks/finance/useDebtsForExpense';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useWithdrawalFromBalanceOptions } from '@/shared/hooks/finance/useWithdrawalFromBalanceOptions';

const SCROLL_HIDE =
  'scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export type PaymentTableVariant = 'module' | 'mobileCard';

interface PaymentTableProps {
  requests: PurchaseRequest[];
  isLoading?: boolean;
  onRefresh?: () => void;
  variant?: PaymentTableVariant;
  /** Mobile tab dengan rantai flex tinggi: scroll mengisi parent, bukan `max-h-[50vh]`. */
  fillScrollHeight?: boolean;
  /** Native mobile payment-process: viewport ~10 baris, scroll di dalam (selaras approvals / expense). */
  fixedMobileViewport?: boolean;
}

export const PaymentTable = ({ 
  requests, 
  isLoading = false,
  onRefresh,
  variant = 'module',
  fillScrollHeight = false,
  fixedMobileViewport = false,
}: PaymentTableProps) => {
  const isMobile = useIsMobile();
  const isMobileCard = variant === 'mobileCard';
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [processWithdrawalSource, setProcessWithdrawalSource] = useState<WithdrawalSourceValue>({});
  const [paymentExpenseTypeId, setPaymentExpenseTypeId] = useState('');
  const [paymentExpenseCategoryId, setPaymentExpenseCategoryId] = useState('');
  const [gatewayVendorBank, setGatewayVendorBank] = useState<GatewayVendorBankFields>({
    bankCode: '',
    accountNumber: '',
    accountHolder: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const { createExpense, isCreating: isCreatingExpense } = useExpenses();
  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories } = useExpenseCategories(paymentExpenseTypeId);
  const { debts: debtsForExpense } = useDebtsForExpense();
  const { balances: bankAccountBalances } = useBankAccountBalances();
  const { gateways } = useWithdrawalFromBalanceOptions();
  const { data: xenditSettings } = useXenditOrgSettings(organizationId);

  // Sync payment form from request when modal opens or request changes
  useEffect(() => {
    if (selectedRequest) {
      setProcessWithdrawalSource({
        debtId: selectedRequest.withdrawal_from_balance,
        bankAccountId: selectedRequest.bank_account_id,
        gatewayProvider: selectedRequest.gateway_wallet_provider ?? undefined,
      });
      setPaymentExpenseTypeId(selectedRequest.expense_type_id ?? '');
      setPaymentExpenseCategoryId(selectedRequest.expense_category_id ?? '');
      setGatewayVendorBank({
        bankCode: selectedRequest.vendor_bank_code?.trim().toUpperCase() ?? '',
        accountNumber: selectedRequest.vendor_bank_account_number?.trim() ?? '',
        accountHolder: selectedRequest.vendor_bank_account_holder?.trim() ?? '',
      });
    }
  }, [
    selectedRequest?.id,
    selectedRequest?.withdrawal_from_balance,
    selectedRequest?.bank_account_id,
    selectedRequest?.gateway_wallet_provider,
    selectedRequest?.expense_type_id,
    selectedRequest?.expense_category_id,
    selectedRequest?.vendor_bank_code,
    selectedRequest?.vendor_bank_account_number,
    selectedRequest?.vendor_bank_account_holder,
  ]);

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
    setProcessWithdrawalSource({
      debtId: request.withdrawal_from_balance,
      bankAccountId: request.bank_account_id,
      gatewayProvider: request.gateway_wallet_provider ?? undefined,
    });
    setPaymentExpenseTypeId(request.expense_type_id ?? '');
    setPaymentExpenseCategoryId(request.expense_category_id ?? '');
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

  const handleProcessPayment = async () => {
    if (!selectedRequest || !organizationId || !user) {
      return;
    }

    if (!paymentExpenseTypeId) {
      toast({
        title: t('payments.expenseTypeRequired', 'Expense type required'),
        description: t('payments.expenseTypeRequiredHint', 'Select an expense type before processing payment.'),
        variant: 'destructive',
      });
      return;
    }

    if (!paymentExpenseCategoryId) {
      toast({
        title: t('payments.expenseCategoryRequired', 'Expense category required'),
        description: t('payments.expenseCategoryRequiredHint', 'Select an expense category before processing payment.'),
        variant: 'destructive',
      });
      return;
    }

    const hasInvoice = !!invoiceFile || !!selectedRequest.invoice_file_path;
    if (!selectedRequest.paid_at && !hasInvoice) {
      toast({
        title: t('payments.invoiceRequired', 'Invoice required'),
        description: t('payments.invoiceRequiredHint', 'Please select an invoice file to upload.'),
        variant: 'destructive',
      });
      return;
    }

    if (!selectedRequest.paid_at && !hasWithdrawalSource(processWithdrawalSource)) {
      toast({
        title: t('expenses.withdrawalFromBalanceRequired'),
        description: t('expenses.withdrawalRequiredToast'),
        variant: 'destructive',
      });
      return;
    }

    const expenseTypeName =
      expenseTypes.find((type) => type.id === paymentExpenseTypeId)?.name ?? '';
    const expenseCategoryName =
      expenseCategories.find((category) => category.id === paymentExpenseCategoryId)?.name ?? '';
    if (!expenseTypeName || !expenseCategoryName) {
      toast({
        title: t('payments.classificationInvalid', 'Invalid classification'),
        description: t('payments.classificationInvalidHint', 'Selected expense type or category is no longer available.'),
        variant: 'destructive',
      });
      return;
    }

    const amount = selectedRequest.amount_idr;
    if (processWithdrawalSource.debtId) {
      const debt = debtsForExpense.find((d) => d.id === processWithdrawalSource.debtId);
      const available = debt?.available_limit ?? 0;
      if (available < amount) {
        toast({
          title: t('payments.insufficientBalance', 'Insufficient balance'),
          description: t('payments.insufficientDebtHint', 'Available limit: Rp {{amount}}', {
            amount: available.toLocaleString('id-ID'),
          }),
          variant: 'destructive',
        });
        return;
      }
    } else if (processWithdrawalSource.bankAccountId) {
      const balance = bankAccountBalances.find(
        (b) => b.bank_account_id === processWithdrawalSource.bankAccountId,
      );
      const available = balance?.balance ?? 0;
      if (available < amount) {
        toast({
          title: t('payments.insufficientBalance', 'Insufficient balance'),
          description: t('payments.insufficientBankHint', 'Available balance: Rp {{amount}}', {
            amount: available.toLocaleString('id-ID'),
          }),
          variant: 'destructive',
        });
        return;
      }
    } else if (processWithdrawalSource.gatewayProvider) {
      const gw = gateways.find((g) => g.provider === processWithdrawalSource.gatewayProvider);
      const available = gw?.usableBalance ?? 0;
      if (available < amount) {
        toast({
          title: t('payments.insufficientBalance', 'Insufficient balance'),
          description: t('payments.insufficientGatewayHint', 'Available gateway balance: Rp {{amount}}', {
            amount: available.toLocaleString('id-ID'),
          }),
          variant: 'destructive',
        });
        return;
      }
    }

    setIsUploadingInvoice(true);
    try {
      let fileName: string;

      if (selectedRequest.invoice_file_path) {
        fileName = selectedRequest.invoice_file_path;
      } else if (invoiceFile) {
        const timestamp = Date.now();
        fileName = `invoices/${organizationId}/${selectedRequest.id}/${timestamp}-${invoiceFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const { error: uploadError } = await supabase.storage
          .from('purchase-documents')
          .upload(fileName, invoiceFile, {
            cacheControl: '31536000',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }
      } else {
        setIsUploadingInvoice(false);
        return;
      }

      await updateStatus.mutateAsync({
        id: selectedRequest.id,
        status: selectedRequest.status,
        invoiceFilePath: fileName,
        expenseTypeId: paymentExpenseTypeId,
        expenseCategoryId: paymentExpenseCategoryId,
        withdrawalFromBalance: processWithdrawalSource.debtId,
        bankAccountId: processWithdrawalSource.bankAccountId,
        gatewayWalletProvider: processWithdrawalSource.gatewayProvider ?? null,
        markAsPaid: false,
      });

      const gatewayProvider = processWithdrawalSource.gatewayProvider;
      const isGatewayDisbursement =
        gatewayProvider === 'xendit' || gatewayProvider === 'brick';

      if (isGatewayDisbursement) {
        const bankCode = gatewayVendorBank.bankCode.trim().toUpperCase();
        const accountNumber = gatewayVendorBank.accountNumber.trim();
        const accountHolder = gatewayVendorBank.accountHolder.trim();

        if (!bankCode || !accountNumber || !accountHolder) {
          toast({
            title: t('payments.vendorBankRequired', 'Vendor bank account required'),
            description: t(
              'payments.vendorBankRequiredHint',
              'Enter vendor bank code, account number, and account holder for gateway disbursement.',
            ),
            variant: 'destructive',
          });
          setIsUploadingInvoice(false);
          return;
        }

        if (gatewayProvider === 'brick' && selectedRequest.amount_idr > 100_000) {
          toast({
            title: t('payments.brickSandboxAmountTooHigh', 'Amount too high for Brick sandbox'),
            description: t(
              'payments.brickSandboxAmountTooHighHint',
              'Brick sandbox supports disbursements up to Rp 100.000. Use a smaller test amount.',
            ),
            variant: 'destructive',
          });
          setIsUploadingInvoice(false);
          return;
        }

        try {
          if (gatewayProvider === 'xendit') {
            if (!xenditSettings?.account?.is_enabled) {
              throw new Error(t('payments.xenditNotEnabled', 'Xendit is not enabled for this organization.'));
            }
            const disburseResult = await executeXenditDisbursement(organizationId, {
              source_type: 'purchase_request',
              source_id: selectedRequest.id,
              bank_code: bankCode,
              account_number: accountNumber,
              account_holder_name: accountHolder,
              amount: selectedRequest.amount_idr,
              description: `Vendor payment ${selectedRequest.request_title ?? selectedRequest.id}`,
            });
            let disbursementSettled =
              disburseResult.rows?.some((row) => String(row.status ?? '') === 'completed') ?? false;
            if (!disbursementSettled) {
              try {
                const pollResult = await pollXenditDisbursements(organizationId);
                disbursementSettled = (pollResult.disbursePoll?.completed ?? 0) > 0;
              } catch {
                /* poll edge action may be unavailable until function deploy */
              }
            }
            if (!disbursementSettled) {
              const { data: stuckRows } = await supabase
                .from('xendit_disbursements')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('source_type', 'purchase_request')
                .eq('source_id', selectedRequest.id)
                .in('status', ['pending', 'processing']);
              for (const row of stuckRows ?? []) {
                await supabase.rpc('reconcile_xendit_disbursement_completed', {
                  p_disbursement_id: row.id,
                });
              }
            }
            try {
              await fetchXenditWalletBalance(organizationId);
            } catch {
              /* balance sync is best-effort */
            }
          } else {
            await executeBrickDisbursement(organizationId, {
              source_type: 'purchase_request',
              source_id: selectedRequest.id,
              bank_code: bankCode,
              account_number: accountNumber,
              account_holder_name: accountHolder,
              amount: selectedRequest.amount_idr,
              description: `Vendor payment ${selectedRequest.request_title ?? selectedRequest.id}`,
            });
          }
        } catch (disburseError) {
          toast({
            title: t('payments.gatewayDisburseFailed', 'Gateway disbursement failed'),
            description:
              disburseError instanceof Error ? disburseError.message : String(disburseError),
            variant: 'destructive',
          });
          if (onRefresh) onRefresh();
          setIsUploadingInvoice(false);
          return;
        }

        toast({
          title: t('payments.gatewayDisburseSubmitted', 'Disbursement submitted'),
          description: t(
            'payments.gatewayDisburseSubmittedHint',
            'Payment is processing via the payment gateway. Expense and bank mutation will be recorded after Xendit/Brick confirms the transfer.',
          ),
        });

        if (organizationId) {
          queryClient.invalidateQueries({ queryKey: ['bank-statement-lines', organizationId] });
          queryClient.invalidateQueries({ queryKey: ['gateway-wallet-balances', organizationId] });
          queryClient.invalidateQueries({ queryKey: ['purchase-requests', organizationId] });
        }

        setInvoiceFile(null);
        setProcessWithdrawalSource({});
        setPaymentExpenseTypeId('');
        setPaymentExpenseCategoryId('');
        setGatewayVendorBank({ bankCode: '', accountNumber: '', accountHolder: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsModalOpen(false);
        if (onRefresh) onRefresh();
        setIsUploadingInvoice(false);
        return;
      }

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
          withdrawal_from_balance: processWithdrawalSource.debtId,
          bank_account_id: processWithdrawalSource.bankAccountId,
          gateway_wallet_provider: processWithdrawalSource.gatewayProvider,
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

      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ['bank-statement-lines', organizationId] });
      }

      setInvoiceFile(null);
      setProcessWithdrawalSource({});
      setPaymentExpenseTypeId('');
      setPaymentExpenseCategoryId('');
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
    const result = await openSupabaseSignedFile({
      bucket: 'purchase-documents',
      filePath,
      expiresInSeconds: 3600,
    });
    if (result.ok) return;
    console.error('Error creating signed URL:', result.error);
    toast({
      title: 'Error',
      description: 'Failed to open invoice. Please try again.',
      variant: 'destructive',
    });
  };

  const fullscreenDialog = isMobile || isMobileCard;
  const cellPx = isMobileCard ? 'px-2 py-2' : 'px-3 py-2';

  const skeletonRows = Array.from({ length: 10 }).map((_, rowIndex) => (
    <TableRow key={rowIndex} className="border-b">
      {Array.from({ length: 11 }).map((__, ci) => (
        <TableCell key={ci} className={cellPx}>
          <Skeleton className="h-4 w-full max-w-[100px]" />
        </TableCell>
      ))}
    </TableRow>
  ));

  if (isLoading && !isMobileCard) {
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

  const scrollWrapClass = cn(
    'scrollbar-hide seamless-scroll min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    isMobileCard
      ? fixedMobileViewport
        ? cn(
            'nested-scroll-touch-chain min-h-0 min-w-0 overflow-y-auto [touch-action:pan-x_pan-y]',
            'h-[min(28rem,calc(100dvh-14rem))] max-h-[28rem] min-h-[11rem] shrink-0',
            SCROLL_HIDE,
          )
        : cn(
            'nested-scroll-touch-chain min-h-0 min-w-0 overflow-y-auto [touch-action:pan-x_pan-y]',
            fillScrollHeight && 'flex-1',
            !fillScrollHeight && 'max-h-[50vh]',
            SCROLL_HIDE,
          )
      : 'min-h-0 flex-1',
  );

  const tableSection = (
    <div className={scrollWrapClass}>
      <table className="w-full min-w-[1400px] caption-bottom text-sm">
        <TableHeader
          className={cn(
            'sticky top-0 z-10',
            isMobileCard ? 'border-b border-white/20 bg-brand-blue' : 'bg-card shadow-sm',
          )}
        >
          {isMobileCard ? (
            <TableRow className="border-b border-white/20 bg-brand-blue hover:bg-brand-blue">
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.request', 'Request')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.requester', 'Requester')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.department', 'Department')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.amount', 'Amount')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.type', 'Type')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.status', 'Status')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.recurring', 'Recurring')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.approvalDate', 'Approval Date')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.paidDate', 'Paid Date')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.paidBy', 'Paid By')}
              </TableHead>
              <TableHead className="h-8 w-16 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('payments.table.actions', 'Actions')}
              </TableHead>
            </TableRow>
          ) : (
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
          )}
        </TableHeader>
        <TableBody>
          {isLoading && isMobileCard ? (
            skeletonRows
          ) : paymentRequests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className={cn('h-16 text-center', isMobileCard && 'py-8')}>
                <CreditCard className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                <p className="mb-1 text-sm text-gray-500">
                  {t('payments.table.emptyTitle', 'No payment requests found')}
                </p>
                <p className="text-xs text-gray-400">
                  {t('payments.table.emptyHint', 'Approved requests will appear here')}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            paymentRequests.map((request) => (
              <TableRow key={request.id} className="hover:bg-muted/40">
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 rounded-md bg-brand-blue/10 p-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-brand-blue" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">{request.request_title}</div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {request.description || t('payments.table.noDescription', 'No description')}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted/40 p-1">
                      <User className="h-3 w-3 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-700">{request.requester_name}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs text-gray-600')}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted/40 p-1">
                      <Building className="h-3 w-3 text-gray-600" />
                    </div>
                    <span>{request.department_name || t('payments.table.notSpecified', 'Not specified')}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <div className="font-bold text-gray-900">{formatToRupiah(request.amount_idr)}</div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <Badge variant="outline" className="text-xs">
                    {getTypeDisplay(request)}
                  </Badge>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>{getStatusBadge(request)}</TableCell>
                <TableCell className={cn(cellPx, 'whitespace-nowrap text-xs')}>
                  <Badge variant={request.is_recurring ? 'default' : 'secondary'}>
                    {request.is_recurring
                      ? t('payments.recurring.yes', 'Recurring')
                      : t('payments.recurring.no', 'One-time')}
                  </Badge>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs text-gray-600')}>
                  {request.approved_at ? (
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-muted/40 p-1">
                        <Calendar className="h-3 w-3 text-gray-600" />
                      </div>
                      <span>{format(new Date(request.approved_at), 'MMM dd, yyyy')}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs text-gray-600')}>
                  {request.paid_at ? (
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-muted/40 p-1">
                        <Calendar className="h-3 w-3 text-gray-600" />
                      </div>
                      <span>{format(new Date(request.paid_at), 'MMM dd, yyyy')}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs text-gray-600')}>
                  {request.paid_by_name ? (
                    <span className="font-medium">{request.paid_by_name}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <button
                    type="button"
                    onClick={() => handleViewDetails(request)}
                    className="text-xs font-medium text-brand-blue hover:text-brand-blue-deep"
                  >
                    {t('payments.table.view', 'View')}
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </table>
    </div>
  );

  const dialogBody =
    selectedRequest != null ? (
      <div className={cn('space-y-4', fullscreenDialog && 'min-h-0 flex-1 overflow-y-auto px-4 py-4 seamless-scroll', fullscreenDialog && SCROLL_HIDE)}>
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

              {/* Payment process */}
              {!selectedRequest.paid_at && (
                <>
                  <Separator className="my-4" />

                  {selectedRequest.payment_status === 'processing' ? (
                    <Card className="border-purple-200 bg-purple-50/50">
                      <CardContent className="px-4 py-4">
                        <p className="text-sm font-medium text-purple-900">
                          {t('payments.mode.processingTitle', 'Payment in progress')}
                        </p>
                        <p className="mt-1 text-xs text-purple-800">
                          {t(
                            'payments.mode.processingHint',
                            'Disbursement was submitted via payment gateway. Wait for completion or refresh status from bank sync.',
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <PaymentExpenseClassificationCard
                        expenseTypeId={paymentExpenseTypeId}
                        expenseCategoryId={paymentExpenseCategoryId}
                        withdrawalSource={processWithdrawalSource}
                        onExpenseTypeChange={setPaymentExpenseTypeId}
                        onExpenseCategoryChange={setPaymentExpenseCategoryId}
                        onWithdrawalSourceChange={setProcessWithdrawalSource}
                      />

                      {(processWithdrawalSource.gatewayProvider === 'xendit' ||
                        processWithdrawalSource.gatewayProvider === 'brick') && (
                        <PaymentGatewayVendorBankCard
                          provider={processWithdrawalSource.gatewayProvider}
                          value={gatewayVendorBank}
                          onChange={setGatewayVendorBank}
                          xenditBanks={xenditSettings?.vaBanks}
                        />
                      )}

                      <Card className="border-slate-200">
                        <CardHeader className="px-4 py-3 pb-2">
                          <CardTitle className="text-base font-semibold text-slate-900">
                            {t('payments.processPaymentTitle', 'Process payment')}
                          </CardTitle>
                          <p className="text-xs font-normal text-slate-500 mt-1">
                            {processWithdrawalSource.gatewayProvider
                              ? t(
                                  'payments.processPaymentGatewayHint',
                                  'Upload invoice, then submit real disbursement via payment gateway. Saldo Xendit/Brick berkurang setelah transfer dikonfirmasi.',
                                )
                              : t(
                                  'payments.processPaymentHint',
                                  'Upload the invoice, then process payment. Balance will be deducted from the selected funding source.',
                                )}
                          </p>
                        </CardHeader>
                        <CardContent className="px-4 py-3 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="invoice-file" className="text-sm font-medium">
                              {t('payments.mode.invoiceFile', 'Invoice file')}{' '}
                              <span className="text-brand-red">*</span>
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
                              {t(
                                'payments.invoiceFormats',
                                'Supported formats: PDF, JPEG, PNG, GIF (Max 10MB)',
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={handleProcessPayment}
                            disabled={
                              !paymentExpenseTypeId ||
                              !paymentExpenseCategoryId ||
                              (!invoiceFile && !selectedRequest?.invoice_file_path) ||
                              isUploadingInvoice ||
                              updateStatus.isPending ||
                              isCreatingExpense ||
                              !hasWithdrawalSource(processWithdrawalSource)
                            }
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isUploadingInvoice || updateStatus.isPending || isCreatingExpense ? (
                              <>
                                <Upload className="mr-2 h-4 w-4 animate-pulse" />
                                {t('payments.processing', 'Processing...')}
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                {t('payments.processPayment', 'Process Payment')}
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </>
              )}
            </div>
    ) : null;

  return (
    <>
      {isMobileCard ? (
        <div
          className={cn(
            'min-w-0 w-full',
            fillScrollHeight && !fixedMobileViewport && 'flex min-h-0 min-w-0 flex-1 flex-col',
          )}
        >
          {tableSection}
        </div>
      ) : (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-semibold text-foreground">
              {t('payments.table.sectionTitle', 'Payment Requests')}
            </h2>
          </div>
          {tableSection}
        </div>
      )}

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setSelectedRequest(null);
            setInvoiceFile(null);
            setProcessWithdrawalSource({});
            setPaymentExpenseTypeId('');
            setPaymentExpenseCategoryId('');
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      >
        <DialogContent
          className={
            fullscreenDialog
              ? 'modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0'
              : 'max-h-[80vh] max-w-2xl overflow-y-auto'
          }
          fullscreenAnimation={fullscreenDialog}
          hideCloseButton={fullscreenDialog}
        >
          {fullscreenDialog ? (
            <>
              <DialogHeader className="safe-area-top flex flex-shrink-0 flex-row flex-nowrap items-stretch gap-0 space-y-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-0 py-0 text-left dark:from-blue-950/20 dark:to-indigo-950/20">
                <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
                  <DialogDescription className="sr-only">
                    {t('payments.dialog.description', 'Payment request details and processing')}
                  </DialogDescription>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-1">
                    <DialogTitle className="m-0 flex min-h-0 min-w-0 items-center truncate text-left text-base font-semibold leading-tight">
                      {t('payments.dialog.title', 'Payment Request Details')}
                    </DialogTitle>
                    <span className="shrink-0">
                      {selectedRequest ? getStatusBadge(selectedRequest) : null}
                    </span>
                  </div>
                  <DialogClose
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-blue/50 bg-background/80 p-0 text-muted-foreground ring-offset-background transition hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <X className="block h-4 w-4 shrink-0" aria-hidden />
                    <span className="sr-only">{t('common.close', 'Close')}</span>
                  </DialogClose>
                </div>
              </DialogHeader>
              {dialogBody}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{t('payments.dialog.title', 'Payment Request Details')}</span>
                  {selectedRequest ? getStatusBadge(selectedRequest) : null}
                </DialogTitle>
              </DialogHeader>
              {dialogBody}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
