import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Progress } from '@/shared/components/ui/progress';
import { Card, CardContent } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useSalesActivityPayments } from '@/shared/hooks/organized/sales';
import { useIncomeTransactions } from '@/shared/hooks/organized/sales';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
import { deleteSalesActivityPaymentWithLinkedIncome } from '@/shared/lib/finance/deleteSalesActivityPaymentWithLinkedIncome';
import { updateIncomeFromSalesPayment } from '@/shared/lib/finance/updateIncomeFromSalesPayment';
import { refetchIncomeModuleQueries } from '@/shared/lib/finance/refetchIncomeModuleQueries';
import { Plus, Calendar, CreditCard, FileText, X, Upload, TrendingUp, CheckCircle2, MoreHorizontal, Download, Edit, Trash2 } from 'lucide-react';
import { InvoicePreviewModal } from './invoice';
import { calculatePaymentSummary, calculateProgressiveRemaining } from '@/shared/utils/paymentCalculations';
import { formatToRupiah } from '@/shared/utils/formatCurrency';

interface PaymentUpdateModalProps {
  open: boolean;
  onClose: () => void;
  salesActivityId: string;
  clientName?: string;
  viewOnly?: boolean;
  onFirstPaymentSuccess?: (payload: { title: string; description: string; service_id: string; sub_service_id: string | null }) => void;
}

/** Digits only, then Indonesian-style thousand separators (.) for display while typing. */
function formatPaymentAmountThousands(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parsePaymentAmountThousands(value: string): number {
  return parseFloat(value.replace(/\D/g, '')) || 0;
}

export const PaymentUpdateModal = ({ open, onClose, salesActivityId, clientName, viewOnly = false, onFirstPaymentSuccess }: PaymentUpdateModalProps) => {
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

  const getPaymentTypeBadge = (type: string | null | undefined) => {
    if (!type) {
      return <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 border-gray-200">Unknown</Badge>;
    }
    
    switch (type.toLowerCase()) {
      case 'down_payment':
        return <Badge variant="secondary" className="text-xs bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25">Down Payment</Badge>;
      case 'final_payment':
        return <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">Final Payment</Badge>;
      case 'partial_payment':
        return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200">Partial Payment</Badge>;
      default:
        console.warn('Unknown payment type:', type);
        return <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 border-gray-200">Unknown</Badge>;
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'Rp 0,00';
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) {
      return '-';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '-';
      }
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return '-';
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
        `Delete this payment (${formatCurrency(amt)})? This cannot be undone.`
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="text-lg font-semibold">
            Payment History - {clientName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="space-y-4 pr-4">
          {/* Payment Summary Card */}
          {paymentSummary && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-blue" />
                    <h4 className="text-sm font-semibold text-slate-800">Payment Progress</h4>
                  </div>
                  {paymentSummary.isFullyPaid && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-semibold">FULLY PAID</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Progress</span>
                    <span className="font-medium">{paymentSummary.progressPercentage.toFixed(1)}%</span>
                  </div>
                  
                  <Progress value={paymentSummary.progressPercentage} className="h-2" />
                  
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-slate-500">Total Amount</div>
                      <div className="font-semibold">{formatToRupiah(paymentSummary.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Paid</div>
                      <div className="font-semibold text-green-600">{formatToRupiah(paymentSummary.totalPaid)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Remaining</div>
                      <div className={`font-semibold ${paymentSummary.isFullyPaid ? 'text-green-600' : 'text-orange-600'}`}>
                        {formatToRupiah(paymentSummary.remainingAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Header Actions */}
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Total Payments: {paymentHistory.length}
              </div>
            </div>
            <Button 
              size="sm" 
              className="text-xs h-8"
              onClick={() => setShowAddPaymentForm(true)}
              disabled={viewOnly || paymentSummary?.isFullyPaid}
            >
              <Plus className="h-3 w-3 mr-1" />
              {viewOnly ? 'View Only' : (paymentSummary?.isFullyPaid ? 'Fully Paid' : 'Add Payment')}
            </Button>
          </div>

          {/* Add Payment Form */}
          {showAddPaymentForm && (
            <div className="mb-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-slate-800">Add New Payment</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAddPaymentForm(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="total-amount" className="text-xs">Total Amount</Label>
                  <Input
                    id="total-amount"
                    type="text"
                    value={formatCurrency(getCurrentTotalAmount())}
                    className="text-xs h-8 bg-gray-50"
                    readOnly
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="remaining-amount" className="text-xs">Remaining Amount</Label>
                  <Input
                    id="remaining-amount"
                    type="text"
                    value={formatCurrency(getRemainingAmount())}
                    className="text-xs h-8 bg-gray-50"
                    readOnly
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="amount" className="text-xs">Payment Amount *</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={newPayment.payment_amount}
                    onChange={(e) =>
                      setNewPayment((prev) => ({
                        ...prev,
                        payment_amount: formatPaymentAmountThousands(e.target.value),
                      }))
                    }
                    className="text-xs h-8"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="date" className="text-xs">Payment Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newPayment.payment_date}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="method" className="text-xs">Payment Method *</Label>
                  <Select
                    value={newPayment.payment_method}
                    onValueChange={(value) => setNewPayment(prev => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type" className="text-xs">Payment Type</Label>
                  <Input
                    id="type"
                    type="text"
                    value={getPaymentTypeLabel()}
                    className="text-xs h-8 bg-gray-50"
                    readOnly
                    disabled
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="invoice" className="text-xs">Upload Invoice</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="invoice"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                      className="text-xs h-8"
                    />
                    {invoiceFile && (
                      <div className="flex items-center text-xs text-green-600">
                        <Upload className="h-3 w-3 mr-1" />
                        {invoiceFile.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes" className="text-xs">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                    className="text-xs resize-none"
                    rows={2}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAddPaymentForm(false)}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleAddPayment}
                  disabled={loading}
                  className="text-xs h-7"
                >
                  {loading ? 'Adding...' : 'Add Payment'}
                </Button>
              </div>
            </div>
          )}

          {editingPayment && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-800">Edit payment</h4>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCancelEdit}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-amount" className="text-xs">
                    Amount *
                  </Label>
                  <Input
                    id="edit-amount"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={editForm.payment_amount}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        payment_amount: formatPaymentAmountThousands(e.target.value),
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-date" className="text-xs">
                    Date *
                  </Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editForm.payment_date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-method" className="text-xs">
                    Method *
                  </Label>
                  <Select
                    value={editForm.payment_method}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger id="edit-method" className="h-8 text-xs">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-receipt" className="text-xs">
                    Replace receipt (optional)
                  </Label>
                  <Input
                    id="edit-receipt"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-notes" className="text-xs">
                    Notes
                  </Label>
                  <Textarea
                    id="edit-notes"
                    value={editForm.notes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="text-xs resize-none"
                    rows={2}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => void handleSaveEdit()}>
                  {loading ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {/* Payment History Table */}
          <div className="min-h-[200px] border border-slate-200 rounded-lg">
            {loading ? (
              <div className="p-6 text-center text-slate-500">Loading payment history...</div>
            ) : paymentHistory.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No payments found</div>
            ) : (
              <div className="overflow-auto max-h-[300px]">
                <table className="w-full">
                  <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Type</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Amount</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Remaining</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Method</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Notes</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {progressivePayments.map((payment, index) => (
                      <tr key={payment.id || `payment-${index}-${payment.payment_date}`} className="hover:bg-slate-50/50">
                        <td className="p-3 text-xs text-slate-700">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {getPaymentTypeBadge(payment.payment_type || 'partial_payment')}
                            <span className="text-xs text-slate-500">#{payment.payment_sequence || index + 1}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-700 text-right font-medium">
                          {formatCurrency(payment.payment_amount || payment.paymentAmount || 0)}
                        </td>
                        <td className="p-3 text-xs text-right">
                          <div className={`font-medium ${getPaymentStatusColor(payment)}`}>
                            {formatCurrency(payment.remainingAfterPayment || 0)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {payment.progressPercentage?.toFixed(1)}% paid
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-600">
                          {payment.payment_method?.replace('_', ' ') || '-'}
                        </td>
                        <td className="p-3 text-xs text-slate-600 max-w-32">
                          {payment.notes ? (
                            <span className="line-clamp-2 break-words" title={payment.notes}>
                              {payment.notes}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {payment.receipt_url && (
                                <DropdownMenuItem onClick={() => window.open(payment.receipt_url, '_blank')}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download Receipt
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleDownloadInvoice(payment)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Generate Invoice
                              </DropdownMenuItem>
                              {!viewOnly && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEditPayment(payment)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => void handleDeletePayment(payment)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
        </ScrollArea>

        {/* Invoice Preview Modal */}
        {showInvoicePreview && selectedPaymentForInvoice && (
          <InvoicePreviewModal
            open={showInvoicePreview}
            onOpenChange={setShowInvoicePreview}
            paymentData={selectedPaymentForInvoice}
            clientName={clientName || ''}
            salesActivityId={salesActivityId}
            salesActivityData={salesActivity}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};