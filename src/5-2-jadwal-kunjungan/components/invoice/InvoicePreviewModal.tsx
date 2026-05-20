import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent } from '@/shared/components/ui/card';
import { InvoiceGenerator, InvoiceData } from '@/shared/services/InvoiceGenerator';
import { Download, Eye, FileText, Plus, Trash2, Save, MoreVertical } from 'lucide-react';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCompanyLogo } from '@/shared/hooks/useCompanyLogo';
import { useSalesActivityPayments } from '@/shared/hooks/organized/sales';
import { useSalesActivityItems } from '@/shared/hooks/organized/sales';
import { useInvoiceTemplate } from '@/shared/hooks/useInvoiceTemplate';
import { useToast } from '@/shared/components/ui/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { generateInvoiceNumber, generateSmartInvoiceTitle, calculatePaymentSummary } from '@/shared/utils/paymentCalculations';
import { debounce } from '@/shared/hooks/optimizedHelpers';
import { CreateTemplateDialog } from './CreateTemplateDialog';
import type { InvoiceTemplate } from '@/shared/types/invoice';
import {
  loadInvoiceImageForPdf,
  resolveInvoiceTemplateAssetRef,
} from '@/shared/lib/invoiceTemplateLogo';

function mergeTemplateIntoInvoiceData(
  prev: InvoiceData,
  template: InvoiceTemplate,
  orgLogoUrl?: string | null,
): InvoiceData {
  const templateLogoUrl = resolveInvoiceTemplateAssetRef(template.company_logo_path);
  const templateSignatureUrl = resolveInvoiceTemplateAssetRef(template.company_signature_path);
  return {
    ...prev,
    companyName: template.company_name || prev.companyName,
    companyPhone: template.company_phone || prev.companyPhone,
    companyEmail: template.company_email || prev.companyEmail,
    companyAddress: template.company_address || prev.companyAddress,
    notes: template.invoice_description || prev.notes,
    companyLogo: template.company_logo_path
      ? templateLogoUrl || orgLogoUrl || undefined
      : orgLogoUrl || undefined,
    companySignature: template.company_signature_path ? templateSignatureUrl : undefined,
  };
}

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentData: any;
  clientName: string;
  salesActivityId: string;
  salesActivityData?: any;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  open,
  onOpenChange,
  paymentData,
  clientName,
  salesActivityId,
  salesActivityData
}) => {
  const { currentOrg, organizationId } = useCurrentOrg();
  const { logoUrl } = useCompanyLogo();
  const { getPaymentHistory } = useSalesActivityPayments();
  const { items: salesActivityItems, loading: itemsLoading } = useSalesActivityItems(salesActivityId);
  const {
    templates = [],
    currentTemplate,
    setCurrentTemplate,
    isSaving = false,
    hasUnsavedChanges = false,
  } = useInvoiceTemplate();
  const [showNewTemplateDialog, setShowNewTemplateDialog] = React.useState(false);
  const { toast } = useToast();

  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  
  // Helper function to safely format dates
  const safeFormatDate = (dateInput: any, formatString: string = 'dd MMM yyyy'): string => {
    try {
      if (!dateInput) return format(new Date(), formatString, { locale: id });
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return format(new Date(), formatString, { locale: id });
      return format(date, formatString, { locale: id });
    } catch (error) {
      console.error('Date format error:', error);
      return format(new Date(), formatString, { locale: id });
    }
  };

  const [invoiceData, setInvoiceData] = useState<InvoiceData>(() => {
    const serviceName = salesActivityData?.services?.name || salesActivityData?.sub_services?.name;
    const paymentSequence = paymentData?.payment_sequence || 1;
    const totalAmountInit = salesActivityData?.total_amount || paymentData?.payment_amount || 0;
    const totalPaidInit = (paymentData?.runningTotal ?? paymentData?.payment_amount) || 0;
    const remainingInit = Math.max(0, totalAmountInit - totalPaidInit);
    
    return {
      companyName: 'Your Company Name',
      companyPhone: '+62 xxx xxxx xxxx', 
      companyEmail: 'info@company.com',
      companyAddress: 'Jl. Example Street No. 123\nJakarta, Indonesia',
      companyLogo: logoUrl || undefined,
      
      invoiceNumber: generateInvoiceNumber(
        paymentData?.payment_type || 'partial_payment', 
        paymentSequence, 
        clientName
      ),
      invoiceDate: safeFormatDate(paymentData?.payment_date),
      dueDate: safeFormatDate(new Date()),
      
      clientName: clientName || 'Client Name',
      clientPhone: '+62 xxx xxxx xxxx',
      
      items: [{
        description: serviceName || salesActivityData?.service_category || 'Service',
        type: salesActivityData?.service_category?.toLowerCase().includes('konsultasi') ? 'Consultation' : 'Service',
        quantity: 1,
        price: totalAmountInit,
        amount: totalAmountInit
      }],
      
      subtotal: totalAmountInit,
      total: totalAmountInit,
      
      paidOn: paymentData?.payment_date ? safeFormatDate(paymentData.payment_date) : undefined,
      remainingAmount: remainingInit,
      paymentInfo: paymentData ? {
        currentPaymentType: paymentData.payment_type,
        currentPaymentAmount: paymentData.payment_amount,
        totalPaid: totalPaidInit,
        paymentSequence: paymentSequence,
        paymentDate: paymentData.payment_date
      } : undefined
    };
  });

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewGenerating, setPreviewGenerating] = useState(false);

  const invoiceDataRef = useRef<InvoiceData>(invoiceData);
  const previewGenerationSeqRef = useRef(0);
  const skipDebouncePreviewRef = useRef(false);
  const modalWasOpenRef = useRef(false);
  const previewBlobUrlRef = useRef<string | null>(null);

  const revokePreviewBlobUrl = React.useCallback(() => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokePreviewBlobUrl(), [revokePreviewBlobUrl]);

  useEffect(() => {
    invoiceDataRef.current = invoiceData;
  }, [invoiceData]);

  const runPreviewGeneration = React.useCallback(async (dataOverride?: InvoiceData) => {
    const seq = ++previewGenerationSeqRef.current;
    const data = dataOverride ?? invoiceDataRef.current;
    setPreviewGenerating(true);
    try {
      const logoSource = data.companyLogo || logoUrl || undefined;
      const [logoData, signatureData] = await Promise.all([
        loadInvoiceImageForPdf(logoSource, 800),
        loadInvoiceImageForPdf(data.companySignature, 400),
      ]);
      const generator = await InvoiceGenerator.create();
      const pdf = generator.generateInvoice({
        ...data,
        companyLogo: logoData,
        companySignature: signatureData,
      });
      const blob = pdf.output('blob') as Blob;
      if (seq !== previewGenerationSeqRef.current) {
        return;
      }
      if (!blob || blob.size < 200) {
        throw new Error('Empty PDF output');
      }
      revokePreviewBlobUrl();
      const blobUrl = URL.createObjectURL(blob);
      previewBlobUrlRef.current = blobUrl;
      setPreviewUrl(blobUrl);
    } catch (error) {
      if (seq !== previewGenerationSeqRef.current) {
        return;
      }
      console.error('❌ Error generating invoice preview:', error);
      toast({
        title: 'Preview failed',
        description: 'Could not render invoice preview. Try again or remove template images.',
        variant: 'destructive',
      });
    } finally {
      if (seq === previewGenerationSeqRef.current) {
        setPreviewGenerating(false);
      }
    }
  }, [logoUrl, toast, revokePreviewBlobUrl]);

  const schedulePreviewAfterTemplateApply = React.useCallback(
    (snapshot: InvoiceData) => {
      skipDebouncePreviewRef.current = true;
      void runPreviewGeneration(snapshot).finally(() => {
        window.setTimeout(() => {
          skipDebouncePreviewRef.current = false;
        }, 700);
      });
    },
    [runPreviewGeneration],
  );

  const debouncedGeneratePreview = useMemo(
    () => debounce(() => {
      void runPreviewGeneration();
    }, 500),
    [runPreviewGeneration],
  );

  const applyTemplateToInvoice = React.useCallback(
    (template: InvoiceTemplate) => {
      setCurrentTemplate(template);
      const next = mergeTemplateIntoInvoiceData(invoiceDataRef.current, template, logoUrl);
      invoiceDataRef.current = next;
      setInvoiceData(next);
      schedulePreviewAfterTemplateApply(next);
    },
    [setCurrentTemplate, logoUrl, schedulePreviewAfterTemplateApply],
  );

  // Effect to update invoice data when sales activity items change
  useEffect(() => {
    if (salesActivityItems && salesActivityItems.length > 0) {
      console.log('🧾 Sales activity items loaded:', salesActivityItems);
      
      // Transform database items to invoice items format
      const invoiceItems = salesActivityItems.map(item => ({
        description: item.service_name || 'Service',
        type: 'Service',
        quantity: item.quantity,
        price: item.unit_price,
        amount: item.total_price
      }));

      // Calculate totals from actual items
      const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

      setInvoiceData((prev) => {
        const next = {
          ...prev,
          items: invoiceItems,
          subtotal,
          total: subtotal,
        };
        invoiceDataRef.current = next;
        return next;
      });

      console.log('💰 Updated invoice with actual items. Total:', subtotal);
    }
  }, [salesActivityItems]);

  useEffect(() => {
    if (open && salesActivityId && currentOrg?.id) {
      loadPaymentData();
    }
  }, [open, salesActivityId, currentOrg?.id]);

  // Apply persisted template once when modal opens (dropdown changes use applyTemplateToInvoice)
  useEffect(() => {
    if (!open) {
      modalWasOpenRef.current = false;
      revokePreviewBlobUrl();
      setPreviewUrl('');
      return;
    }
    const justOpened = !modalWasOpenRef.current;
    modalWasOpenRef.current = true;
    if (justOpened && currentTemplate) {
      const next = mergeTemplateIntoInvoiceData(invoiceDataRef.current, currentTemplate, logoUrl);
      invoiceDataRef.current = next;
      setInvoiceData(next);
      schedulePreviewAfterTemplateApply(next);
    }
  }, [open, currentTemplate, logoUrl, schedulePreviewAfterTemplateApply]);

  useEffect(() => {
    if (!open || skipDebouncePreviewRef.current) return;
    debouncedGeneratePreview();
  }, [open, invoiceData, debouncedGeneratePreview]);

  const loadPaymentData = async () => {
    try {
      console.log('🔍 Loading payment data for salesActivityId:', salesActivityId);
      console.log('🏢 Current org id:', currentOrg?.id);
      console.log('📋 Current paymentData from props:', paymentData);

      // Guard: wait until organization is ready; fall back to local data to avoid blocking preview
      if (!currentOrg?.id) {
        console.log('⏳ Organization not ready yet. Skipping history fetch and using local payment data for preview.');
        if (salesActivityData?.total_amount) {
          const totalPaidLocal = (paymentData?.runningTotal ?? paymentData?.payment_amount) || 0;
          const remainingLocal = Math.max(0, salesActivityData.total_amount - totalPaidLocal);
          setInvoiceData(prev => ({
            ...prev,
            remainingAmount: remainingLocal,
            paymentInfo: prev.paymentInfo ? { ...prev.paymentInfo, totalPaid: totalPaidLocal } : prev.paymentInfo
          }));
          // Trigger preview (debounced)
          debouncedGeneratePreview();
        }
        return;
      }
      
      const history = await getPaymentHistory(salesActivityId, organizationId || currentOrg?.id || undefined);
      setPaymentHistory(history || []);
      console.log('📊 Payment history loaded:', history);
      
      if (salesActivityData?.total_amount) {
        const summary = calculatePaymentSummary(salesActivityData.total_amount, history || []);
        setPaymentSummary(summary);
        console.log('📊 Payment summary calculated:', summary);
        
        const serviceName = salesActivityData?.services?.name || salesActivityData?.sub_services?.name;
        
        // Prepare previous payments data (semua pembayaran kecuali yang saat ini)
        const currentPaymentId = paymentData?.id;
        const currentPaymentSequence = paymentData?.payment_sequence;
        
        console.log('🔍 Filtering payments - currentPaymentId:', currentPaymentId, 'currentSequence:', currentPaymentSequence);
        console.log('📋 All payment history:', history);
        
        const previousPayments = (history || [])
          .filter(payment => {
            // Filter out current payment by sequence number (more reliable than ID)
            const isDifferentPayment = payment.payment_sequence !== currentPaymentSequence;
            console.log(`Payment ${payment.payment_sequence}: ${isDifferentPayment ? 'INCLUDED' : 'EXCLUDED'} (current: ${currentPaymentSequence})`);
            return isDifferentPayment;
          })
          .map(payment => ({
            paymentDate: payment.payment_date,
            amount: payment.payment_amount,
            paymentType: payment.payment_type,
            sequence: payment.payment_sequence
          }));

        console.log('📜 Previous payments after filtering:', previousPayments);

        // Update totals and remaining based on actual sales activity items
        let invoiceItems = [];
        let calculatedSubtotal = salesActivityData.total_amount;
        
        if (salesActivityItems && salesActivityItems.length > 0) {
          // Use actual items from database
          invoiceItems = salesActivityItems.map(item => ({
            description: item.service_name || 'Service',
            type: item.sub_service_name ? 'Sub Service' : 'Service',
            quantity: item.quantity,
            price: item.unit_price,
            amount: item.total_price
          }));
          calculatedSubtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
          console.log('📋 Using actual sales activity items:', invoiceItems);
        } else {
          // Fallback to single service item
          invoiceItems = [{
            description: serviceName || salesActivityData.service_category || 'Service',
            type: salesActivityData.service_category?.toLowerCase().includes('konsultasi') ? 'Consultation' : 'Service',
            quantity: 1,
            price: salesActivityData.total_amount,
            amount: salesActivityData.total_amount,
          }];
          console.log('📋 Using fallback single item');
        }

        setInvoiceData((prev) => {
          const next = {
            ...prev,
            items: invoiceItems,
            subtotal: calculatedSubtotal,
            total: calculatedSubtotal,
            remainingAmount: summary.remainingAmount,
            paymentInfo: paymentData
              ? {
                  currentPaymentType: paymentData.payment_type,
                  currentPaymentAmount: paymentData.payment_amount,
                  totalPaid: summary.totalPaid,
                  paymentSequence: paymentData.payment_sequence || 1,
                  paymentDate: paymentData.payment_date,
                }
              : prev.paymentInfo,
            previousPayments: previousPayments.length > 0 ? previousPayments : undefined,
          };
          invoiceDataRef.current = next;
          return next;
        });

        queueMicrotask(() => void runPreviewGeneration());
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
    }
  };

  const generatePreview = async () => {
    try {
      console.log('🎯 generatePreview called with invoiceData:', {
        paymentInfo: invoiceData.paymentInfo,
        remainingAmount: invoiceData.remainingAmount,
        total: invoiceData.total,
        subtotal: invoiceData.subtotal
      });
      
      await runPreviewGeneration();
    } catch (error) {
      console.error('❌ Error generating preview:', error);
    }
  };

  const handleDownload = async () => {
    try {
      const [logoData, signatureData] = await Promise.all([
        loadInvoiceImageForPdf(invoiceData.companyLogo || logoUrl || undefined, 800),
        loadInvoiceImageForPdf(invoiceData.companySignature, 400),
      ]);
      const generator = await InvoiceGenerator.create();
      const pdf = generator.generateInvoice({
        ...invoiceData,
        companyLogo: logoData,
        companySignature: signatureData,
      });
      const filename = `Invoice-${invoiceData.companyName.replace(/\s+/g, '')}-${invoiceData.invoiceNumber}.pdf`;
      generator.download(filename);
      
      toast({
        title: "Success",
        description: "Invoice downloaded successfully",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast({
        title: "Error",
        description: "Failed to download invoice",
        variant: "destructive",
      });
    }
  };

  const updateInvoiceData = (field: keyof InvoiceData, value: any) => {
    setInvoiceData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setInvoiceData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Recalculate amount if price or quantity changed
      if (field === 'price' || field === 'quantity') {
        newItems[index].amount = newItems[index].price * newItems[index].quantity;
      }
      
      // Recalculate totals
      const subtotal = newItems.reduce((sum, item) => sum + item.amount, 0);
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        total: subtotal
      };
    });
  };

  const addItem = () => {
    setInvoiceData(prev => {
      const newItems = [...prev.items, {
        description: '',
        type: 'Service',
        quantity: 1,
        price: 0,
        amount: 0
      }];
      
      // Recalculate totals
      const subtotal = newItems.reduce((sum, item) => sum + item.amount, 0);
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        total: subtotal
      };
    });
  };

  const removeItem = (index: number) => {
    setInvoiceData(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      
      // Recalculate totals
      const subtotal = newItems.reduce((sum, item) => sum + item.amount, 0);
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        total: subtotal
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {paymentData && (
              <>
                {paymentData.payment_type === 'down_payment' && `Invoice - Down Payment #${paymentData.payment_sequence || 1}`}
                {paymentData.payment_type === 'partial_payment' && `Invoice - Partial Payment #${paymentData.payment_sequence || 1}`}
                {paymentData.payment_type === 'final_payment' && 'Invoice - Final Payment'}
              </>
            )}
            {!paymentData && 'Invoice Preview & Customization'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Left side - Invoice Form */}
          <div className="w-2/5 overflow-y-auto space-y-4 pr-2">
            {/* Template Selection */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Template</h3>
                  <div className="flex items-center gap-1">
                    {isSaving && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Save className="h-3 w-3 animate-spin" />
                        Saving...
                      </div>
                    )}
                    {hasUnsavedChanges && !isSaving && (
                      <div className="text-xs text-amber-600">Unsaved</div>
                    )}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  {templates.length > 0 ? (
                    <div className="flex-1">
                      <Label className="text-xs">Load from Template</Label>
                      <select 
                        className="w-full text-xs h-8 border border-input rounded-md px-3 bg-background"
                        value={currentTemplate?.id || ''}
                        onChange={(e) => {
                          const template = templates.find(t => t.id === e.target.value);
                          if (template) {
                            applyTemplateToInvoice(template);
                          }
                        }}
                      >
                        <option value="">Select template...</option>
                        {templates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.template_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <Label className="text-xs">Load from Template</Label>
                      <div className="text-xs text-muted-foreground">No templates found</div>
                    </div>
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                      <DropdownMenuItem 
                        onClick={() => setShowNewTemplateDialog(true)}
                        className="cursor-pointer hover:bg-muted"
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Create New Template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>

            {/* Client Information */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-3">Client Information</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="client-name" className="text-xs">Client Name</Label>
                    <Input
                      id="client-name"
                      value={invoiceData.clientName}
                      onChange={(e) => updateInvoiceData('clientName', e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="client-phone" className="text-xs">Client Phone</Label>
                    <Input
                      id="client-phone"
                      value={invoiceData.clientPhone}
                      onChange={(e) => updateInvoiceData('clientPhone', e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Details */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-3">Invoice Details</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="invoice-number" className="text-xs">Invoice Number</Label>
                    <Input
                      id="invoice-number"
                      value={invoiceData.invoiceNumber}
                      onChange={(e) => updateInvoiceData('invoiceNumber', e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="invoice-date" className="text-xs">Invoice Date</Label>
                      <Input
                        id="invoice-date"
                        type="date"
                        value={invoiceData.invoiceDate ? safeFormatDate(invoiceData.invoiceDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
          if (e.target.value) {
            updateInvoiceData('invoiceDate', safeFormatDate(e.target.value));
          }
        }}
                        className="text-xs h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="due-date" className="text-xs">Due Date</Label>
                      <Input
                        id="due-date"
                        type="date"
                        value={invoiceData.dueDate ? safeFormatDate(invoiceData.dueDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
          if (e.target.value) {
            updateInvoiceData('dueDate', safeFormatDate(e.target.value));
          }
        }}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Payment Details */}
            {paymentData && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 text-primary">Current Payment Details</h3>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">Payment Type</div>
                      <div className="font-semibold text-sm">
                        {paymentData.payment_type === 'down_payment' && `Down Payment #${paymentData.payment_sequence || 1}`}
                        {paymentData.payment_type === 'partial_payment' && `Partial Payment #${paymentData.payment_sequence || 1}`}
                        {paymentData.payment_type === 'final_payment' && 'Final Payment'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">Current Payment Amount</div>
                      <div className="font-bold text-lg text-primary">
                        Rp {paymentData.payment_amount?.toLocaleString('id-ID')}
                      </div>
                    </div>
                    {paymentData.payment_date && (
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-muted-foreground mb-1">Payment Date</div>
                        <div className="font-medium text-sm">
                          {safeFormatDate(paymentData.payment_date)}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Summary */}
            {paymentSummary && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Payment Summary</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Total Item Value:</span>
                      <span className="font-medium">Rp {paymentSummary.totalAmount?.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Paid:</span>
                      <span className="text-green-600 font-medium">Rp {paymentSummary.totalPaid?.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining Balance:</span>
                      <span className="text-red-600 font-medium">Rp {paymentSummary.remainingAmount?.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Progress:</span>
                      <span className="font-medium">{paymentSummary.progressPercentage?.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Item Details */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Item Details</h3>
                  <Button
                    onClick={addItem}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {invoiceData.items.map((item, index) => (
                    <div key={index} className="space-y-3 p-3 border rounded-lg relative">
                      {invoiceData.items.length > 1 && (
                        <Button
                          onClick={() => removeItem(index)}
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2 h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <div>
                        <Label htmlFor={`item-desc-${index}`} className="text-xs">Description</Label>
                        <Input
                          id={`item-desc-${index}`}
                          placeholder="Enter item description"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="text-xs h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`item-type-${index}`} className="text-xs">Type</Label>
                        <Input
                          id={`item-type-${index}`}
                          placeholder="Service, Product, etc."
                          value={item.type}
                          onChange={(e) => updateItem(index, 'type', e.target.value)}
                          className="text-xs h-8"
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label htmlFor={`item-qty-${index}`} className="text-xs">Quantity</Label>
                          <Input
                            id={`item-qty-${index}`}
                            type="number"
                            min="1"
                            placeholder="1"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="text-xs h-8"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`item-price-${index}`} className="text-xs">Price</Label>
                          <Input
                            id={`item-price-${index}`}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.price || ''}
                            onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                            className="text-xs h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Amount</Label>
                          <Input
                            value={item.amount ? item.amount.toLocaleString('id-ID') : '0'}
                            className="text-xs h-8 bg-gray-50"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                
                {/* Totals Summary */}
                <div className="mt-4 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Subtotal:</span>
                      <span className="font-medium">Rp {invoiceData.subtotal?.toLocaleString('id-ID') || '0'}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total:</span>
                      <span>Rp {invoiceData.total?.toLocaleString('id-ID') || '0'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right side - PDF Preview */}
          <div className="w-3/5 border rounded-lg overflow-hidden bg-gray-100">
            <div className="h-full flex flex-col">
              <div className="p-3 bg-white border-b flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Invoice Preview</span>
              </div>
              <div className="min-h-[420px] flex-1 p-2">
                {previewUrl ? (
                  <div className="relative h-full min-h-[400px] w-full">
                    <iframe
                      src={previewUrl}
                      className={`h-full min-h-[400px] w-full rounded border-0 ${previewGenerating ? 'opacity-60' : ''}`}
                      title="Invoice Preview"
                    />
                    {previewGenerating ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-white/50 text-sm text-gray-600">
                        Updating preview…
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[400px] w-full items-center justify-center text-gray-500">
                    {previewGenerating ? 'Loading preview...' : 'Select a template or wait for preview...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Invoice
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* New Template Creation Dialog */}
      <CreateTemplateDialog
        open={showNewTemplateDialog}
        onOpenChange={setShowNewTemplateDialog}
        onTemplateCreated={applyTemplateToInvoice}
      />
    </Dialog>
  );
};