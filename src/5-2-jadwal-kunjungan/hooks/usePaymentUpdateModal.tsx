import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/shared/components/ui/badge';
import { useSalesActivityPayments, useIncomeTransactions } from '@/shared/hooks/organized/sales';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
import { deleteSalesActivityPaymentWithLinkedIncome } from '@/shared/lib/finance/deleteSalesActivityPaymentWithLinkedIncome';
import { updateIncomeFromSalesPayment } from '@/shared/lib/finance/updateIncomeFromSalesPayment';
import { refetchIncomeModuleQueries } from '@/shared/lib/finance/refetchIncomeModuleQueries';
import { calculatePaymentSummary, calculateProgressiveRemaining } from '@/shared/utils/paymentCalculations';
import { formatPaymentAmountThousands, parsePaymentAmountThousands } from '@/5-2-jadwal-kunjungan/utils/paymentAmountInput';

export type PaymentUpdateModalVariant = 'default' | 'livechat';

export type UsePaymentUpdateModalParams = {
  open: boolean;
  salesActivityId: string;
  clientName?: string;
  viewOnly?: boolean;
  variant?: PaymentUpdateModalVariant;
  onFirstPaymentSuccess?: (payload: {
    title: string;
    description: string;
    service_id: string;
    sub_service_id: string | null;
  }) => void;
};

export function formatPaymentCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Rp 0,00';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPaymentDate(dateString: string | null | undefined) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

export function getPaymentTypeBadge(type: string | null | undefined) {
  if (!type) {
    return (
      <Badge variant="secondary" className="whitespace-nowrap text-xs bg-gray-100 text-gray-700 border-gray-200">
        Unknown
      </Badge>
    );
  }
  switch (type.toLowerCase()) {
    case 'down_payment':
      return (
        <Badge
          variant="secondary"
          className="whitespace-nowrap text-xs bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25"
        >
          Down Payment
        </Badge>
      );
    case 'final_payment':
      return (
        <Badge variant="secondary" className="whitespace-nowrap text-xs bg-green-100 text-green-700 border-green-200">
          Final Payment
        </Badge>
      );
    case 'partial_payment':
      return (
        <Badge variant="secondary" className="whitespace-nowrap text-xs bg-orange-100 text-orange-700 border-orange-200">
          Partial Payment
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="whitespace-nowrap text-xs bg-gray-100 text-gray-700 border-gray-200">
          Unknown
        </Badge>
      );
  }
}

export function usePaymentUpdateModal({
  open,
  salesActivityId,
  clientName,
  viewOnly = false,
  variant = 'default',
  onFirstPaymentSuccess,
}: UsePaymentUpdateModalParams) {
  const isLivechatVariant = variant === 'livechat';
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [salesActivity, setSalesActivity] = useState<any>(null);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [progressivePayments, setProgressivePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedPaymentForInvoice, setSelectedPaymentForInvoice] = useState<any>(null);
  const [newPayment, setNewPayment] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    payment_type: 'partial_payment' as 'down_payment' | 'final_payment' | 'partial_payment',
    notes: '',
    receipt_url: ''
  });
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    payment_amount: '',
    payment_date: '',
    payment_method: '',
    notes: '',
  });
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const { updateBalance } = useBankAccountBalances();
  const { getPaymentHistory, createPaymentHistory, updatePaymentHistory } = useSalesActivityPayments();
  const { createIncomeTransaction } = useIncomeTransactions();
  const { user } = useCurrentUser();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();

  useEffect(() => {
    if (open && salesActivityId) {
      loadData();
    }
  }, [open, salesActivityId]);

  // Recalculate payment summary when both salesActivity and paymentHistory are available
  useEffect(() => {
    console.log('🔄 Recalculating payment summary:', {
      totalAmount: salesActivity?.total_amount,
      paymentHistoryCount: paymentHistory.length,
      paymentHistory: paymentHistory,
      hasSalesActivity: !!salesActivity
    });
    
    // Always calculate summary if we have sales activity data, even if paymentHistory is empty
    if (salesActivity?.total_amount !== undefined) {
      const summary = calculatePaymentSummary(salesActivity.total_amount, paymentHistory || []);
      console.log('📊 Calculated payment summary:', summary);
      setPaymentSummary(summary);
      
      const progressive = calculateProgressiveRemaining(salesActivity.total_amount, paymentHistory || []);
      console.log('📈 Progressive payments:', progressive);
      console.log('📈 Progressive payments details:', progressive.map(p => ({
        id: p.id,
        payment_type: p.payment_type,
        payment_amount: p.payment_amount,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        payment_sequence: p.payment_sequence,
        remainingAfterPayment: p.remainingAfterPayment,
        progressPercentage: p.progressPercentage
      })));
      console.log('📈 Full payment object (first):', progressive[0]);
      setProgressivePayments(progressive);
    } else {
      console.log('⚠️ Cannot calculate summary - missing total_amount');
    }
  }, [salesActivity, paymentHistory]);


  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load sales activity data first
      const { data: salesActivityData, error: salesActivityError } = await supabase
        .from('sales_activities')
        .select(`
          total_amount, 
          remaining_amount, 
          service_id, 
          sub_service_id, 
          income_type_id, 
          income_category_id,
          activity_type,
          description,
          services:service_id(name),
          sub_services:sub_service_id(name)
        `)
        .eq('id', salesActivityId)
        .single();

      if (salesActivityError) {
        throw salesActivityError;
      }

      setSalesActivity(salesActivityData);
      
      // Load payment history
      const history = await getPaymentHistory(salesActivityId, organizationId);
      setPaymentHistory(history || []);
      console.log('📊 Payment history loaded in PaymentUpdateModal:', history);
      
      // Calculate payment summary and progressive payments with fresh data
      if (salesActivityData?.total_amount) {
        const summary = calculatePaymentSummary(salesActivityData.total_amount, history || []);
        setPaymentSummary(summary);
        
        const progressive = calculateProgressiveRemaining(salesActivityData.total_amount, history || []);
        setProgressivePayments(progressive);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load payment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate current total amount (original - previous payments)
  const getCurrentTotalAmount = () => {
    if (!salesActivity?.total_amount) return 0;
    const totalPaid = paymentHistory.reduce((sum, payment) => sum + payment.payment_amount, 0);
    return Math.max(0, salesActivity.total_amount - totalPaid);
  };

  // Calculate remaining amount (current total - current payment input)
  const getRemainingAmount = () => {
    const currentTotal = getCurrentTotalAmount();
    const currentPayment = parsePaymentAmountThousands(newPayment.payment_amount);
    return Math.max(0, currentTotal - currentPayment);
  };

  // Auto-determine payment type based on remaining amount
  const getPaymentType = () => {
    const remaining = getRemainingAmount();
    return remaining === 0 ? 'final_payment' : 'partial_payment';
  };

  const getPaymentTypeLabel = () => {
    const type = getPaymentType();
    return type === 'final_payment' ? 'Final Payment' : 'Partial Payment';
  };

  const handleAddPayment = async () => {
    const paymentAmountNum = parsePaymentAmountThousands(newPayment.payment_amount);
    if (paymentAmountNum <= 0 || !newPayment.payment_method) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      let invoiceUrl = '';
      
      // Handle file upload if present
      if (invoiceFile) {
        const fileExt = invoiceFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('income-receipts')
          .upload(filePath, invoiceFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: "Error",
            description: "Failed to upload invoice",
            variant: "destructive",
          });
          return;
        }

        invoiceUrl = filePath;
      }

      // Get current payment count to determine sequence
      const existingPayments = await getPaymentHistory(salesActivityId, organizationId);
      const nextSequence = (existingPayments?.length || 0) + 1;
      
      // Create payment history
      const insertedPayment = await createPaymentHistory({
        sales_activity_id: salesActivityId,
        payment_amount: paymentAmountNum,
        payment_date: newPayment.payment_date,
        payment_method: newPayment.payment_method,
        payment_type: getPaymentType(), // Use auto-determined type
        payment_sequence: nextSequence,
        organization_id: organizationId!,
        created_by: user?.id || '',
        receipt_url: invoiceUrl || newPayment.receipt_url || undefined,
        notes: newPayment.notes || null,
      });

      // Create income transaction when client name exists (useIncomeTransactions from sales.ts returns mutateAsync as this fn — do not call .mutateAsync on it).
      const trimmedClient = (clientName ?? '').trim();
      let incomePostError: string | null = null;
      if (trimmedClient && createIncomeTransaction) {
        try {
          await createIncomeTransaction({
            transaction_date: newPayment.payment_date,
            amount: paymentAmountNum,
            customer_name: trimmedClient,
            payment_method: newPayment.payment_method === 'transfer' ? 'bank_transfer' : newPayment.payment_method,
            income_type_id: salesActivity?.income_type_id,
            category_id: salesActivity?.income_category_id,
            service_id: salesActivity?.service_id,
            sub_service_id: salesActivity?.sub_service_id,
            description: `${getPaymentType().replace('_', ' ')} - ${salesActivity?.activity_type || 'Sales Activity'}: ${trimmedClient}`,
            receipt_url: invoiceUrl || newPayment.receipt_url || undefined,
            sales_activity_payment_id: insertedPayment?.id,
            status: 'pending',
          });
        } catch (incomeError: unknown) {
          console.error('Error creating income transaction:', incomeError);
          const msg =
            typeof incomeError === 'object' &&
            incomeError !== null &&
            'message' in incomeError &&
            typeof (incomeError as { message?: unknown }).message === 'string'
              ? (incomeError as { message: string }).message
              : 'Unknown error';
          incomePostError = msg;
        }
      }

      toast({
        title: incomePostError ? 'Payment saved' : 'Success',
        description: incomePostError
          ? `Payment was saved, but the income entry failed: ${incomePostError}`
          : trimmedClient
            ? 'Payment and income transaction added successfully'
            : 'Payment recorded successfully',
        variant: incomePostError ? 'destructive' : 'default',
      });

      // Reset form
      setNewPayment({
        payment_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        payment_type: 'partial_payment',
        notes: '',
        receipt_url: ''
      });
      setInvoiceFile(null);
      setShowAddPaymentForm(false);

      // First payment: notify parent to open Create New Task dialog (only once per activity)
      if (existingPayments?.length === 0 && onFirstPaymentSuccess && salesActivity) {
        const servicesObj = Array.isArray(salesActivity?.services) ? salesActivity?.services?.[0] : salesActivity?.services;
        const subServicesObj = Array.isArray(salesActivity?.sub_services) ? salesActivity?.sub_services?.[0] : salesActivity?.sub_services;
        const serviceName = (servicesObj as any)?.name ?? salesActivity?.service_id ?? '';
        const subServiceName = (subServicesObj as any)?.name ?? salesActivity?.sub_service_id ?? '';
        const title = `${clientName ?? ''}-${serviceName}-${subServiceName}`;
        const description = salesActivity?.description ?? '';
        onFirstPaymentSuccess({
          title,
          description,
          service_id: salesActivity?.service_id ?? '',
          sub_service_id: salesActivity?.sub_service_id ?? null,
        });
      }
      
      // Reload all data
      await loadData();
    } catch (error) {
      console.error('Error adding payment:', error);
      toast({
        title: "Error",
        description: "Failed to add payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = (payment: any) => {
    setSelectedPaymentForInvoice(payment);
    setShowInvoicePreview(true);
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    const amt = Number(payment?.payment_amount ?? 0);
    setEditForm({
      payment_amount: formatPaymentAmountThousands(String(Math.round(amt))),
      payment_date: typeof payment?.payment_date === 'string' ? payment.payment_date.slice(0, 10) : '',
      payment_method: payment?.payment_method ?? '',
      notes: payment?.notes ?? '',
    });
    setEditReceiptFile(null);
  };

  const handleCancelEdit = () => {
    setEditingPayment(null);
    setEditReceiptFile(null);
  };

  const handleSaveEdit = async () => {
    if (!organizationId || !editingPayment?.id) {
      toast({ title: 'Error', description: 'Missing organization or payment.', variant: 'destructive' });
      return;
    }
    const amt = parsePaymentAmountThousands(editForm.payment_amount);
    if (amt <= 0 || !editForm.payment_method) {
      toast({
        title: 'Error',
        description: 'Please fill in amount and payment method.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      let receiptPath: string | null = (editingPayment.receipt_url as string | null) ?? null;
      if (editReceiptFile) {
        const fileExt = editReceiptFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('income-receipts').upload(filePath, editReceiptFile);
        if (uploadError) {
          toast({ title: 'Error', description: 'Failed to upload receipt', variant: 'destructive' });
          return;
        }
        receiptPath = filePath;
      }

      await updatePaymentHistory(
        editingPayment.id,
        {
          payment_amount: amt,
          payment_date: editForm.payment_date,
          payment_method: editForm.payment_method,
          notes: editForm.notes || null,
          receipt_url: receiptPath,
        },
        organizationId,
      );

      await updateIncomeFromSalesPayment({
        supabase,
        organizationId,
        salesActivityPaymentId: editingPayment.id,
        patch: {
          amount: amt,
          transaction_date: editForm.payment_date,
          payment_method:
            editForm.payment_method === 'transfer' ? 'bank_transfer' : editForm.payment_method,
          description: `${String(editingPayment.payment_type ?? 'partial_payment').replace('_', ' ')} - ${salesActivity?.activity_type || 'Sales Activity'}: ${(clientName ?? '').trim()}`,
          receipt_file_path: receiptPath ?? undefined,
        },
        updateBalance,
      });

      await refetchIncomeModuleQueries(queryClient, organizationId);
      await queryClient.invalidateQueries({ queryKey: ['sales-activity-payments'] });
      toast({ title: 'Success', description: 'Payment updated.' });
      handleCancelEdit();
      await loadData();
    } catch (error) {
      console.error('Error saving payment edit:', error);
      toast({
        title: 'Error',
        description: 'Failed to update payment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (payment: { id?: string; payment_amount?: number }) => {
    if (viewOnly) return;
    const paymentId = payment?.id;
    if (!paymentId) {
      toast({
        title: 'Error',
        description: 'Invalid payment record.',
        variant: 'destructive',
      });
      return;
    }
    if (!organizationId) {
      toast({
        title: 'Error',
        description: 'Organization is required.',
        variant: 'destructive',
      });
      return;
    }

    const amt = payment.payment_amount ?? 0;
    if (
      !window.confirm(
        `Delete this payment (${formatPaymentCurrency(amt)})? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await deleteSalesActivityPaymentWithLinkedIncome({
        supabase,
        organizationId,
        paymentId,
        updateBalance,
      });
      await refetchIncomeModuleQueries(queryClient, organizationId);
      await queryClient.invalidateQueries({ queryKey: ['sales-activity-payments'] });
      toast({
        title: 'Success',
        description: 'Payment removed.',
      });
      await loadData();
    } catch (err) {
      console.error('Error deleting payment:', err);
      const raw = String((err as Error)?.message ?? '').toUpperCase();
      const fkBlocked =
        raw.includes('INCOME_HAS_ALLOCATIONS') ||
        raw.includes('INCOME_ALLOCATIONS') ||
        (raw.includes('VIOLATES FOREIGN KEY') && raw.includes('INCOME'));
      toast({
        title: 'Error',
        description: fkBlocked
          ? 'Pendapatan terkait masih dialokasikan ke pengeluaran/hutang. Hapus alokasi tersebut dulu, lalu coba lagi.'
          : 'Gagal menghapus pembayaran.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatusColor = (payment: any) => {
    if (payment.remainingAfterPayment === 0) return 'text-green-600';
    if (payment.payment_type === 'down_payment') return 'text-brand-blue';
    return 'text-orange-600';
  };


  return {
    isLivechatVariant,
    viewOnly,
    clientName,
    organizationId,
    salesActivityId,
    salesActivity,
    paymentHistory,
    paymentSummary,
    progressivePayments,
    loading,
    showAddPaymentForm,
    setShowAddPaymentForm,
    invoiceFile,
    setInvoiceFile,
    showInvoicePreview,
    setShowInvoicePreview,
    selectedPaymentForInvoice,
    newPayment,
    setNewPayment,
    editingPayment,
    editForm,
    setEditForm,
    editReceiptFile,
    setEditReceiptFile,
    formatPaymentAmountThousands,
    formatPaymentCurrency,
    formatPaymentDate,
    getPaymentTypeBadge,
    getCurrentTotalAmount,
    getRemainingAmount,
    getPaymentTypeLabel,
    handleAddPayment,
    handleDownloadInvoice,
    handleEditPayment,
    handleCancelEdit,
    handleSaveEdit,
    handleDeletePayment,
    getPaymentStatusColor,
    loadData,
  };
}

export type PaymentUpdateModalModel = ReturnType<typeof usePaymentUpdateModal>;
