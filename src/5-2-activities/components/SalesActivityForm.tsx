import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useSalesActivityMasterData, type SalesActivity } from '@/shared/hooks/organized/sales';
import { useToast } from '@/shared/components/ui/use-toast';
import { devLog } from '@/shared/lib/logger';
import { useIncomeTransactions } from '@/shared/hooks/organized/sales';
import { useSalesActivityPayments } from '@/shared/hooks/organized/sales';
import { SalesActivityItemsManager } from './SalesActivityItemsManager';
import type { SalesActivityItemsManagerHandle } from './SalesActivityItemsManager';
import { format } from 'date-fns';

const formSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  client_phone: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal('')),
  activity_type: z.string().min(1, 'Activity type is required'),
  income_type_id: z.string().optional(),
  income_category_id: z.string().optional(),
  service_id: z.string().optional(),
  sub_service_id: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  date: z.string().min(1, 'Date is required'),
  follow_up_date: z.string().optional(),
  down_payment_amount: z.number().min(0).optional(),
  remaining_amount: z.number().min(0).optional(),
  is_down_payment: z.boolean().optional(),
  payment_method: z.string().optional(),
  is_paid: z.boolean().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SalesActivityFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  activity?: SalesActivity | null;
  /** Tampilkan data tanpa mengizinkan penyimpanan (mode lihat detail). */
  readOnly?: boolean;
}

export const SalesActivityForm = ({ onSuccess, onCancel, activity, readOnly = false }: SalesActivityFormProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedIncomeType, setSelectedIncomeType] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<string | undefined>(activity?.id);
  const [totalAmountFromItems, setTotalAmountFromItems] = useState(0);
  const itemsManagerRef = React.useRef<SalesActivityItemsManagerHandle>(null);
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const { createIncomeTransaction } = useIncomeTransactions();
  const { handleDownPayment, handleFinalPayment, getPaymentHistory } = useSalesActivityPayments();
  const {
    incomeTypes,
    incomeTypesLoading,
    incomeCategories,
    getCategoriesByIncomeType,
    services,
    parentServices,
    getSubServicesByService,
    masterDataError,
  } = useSalesActivityMasterData();

  // Debug: Log income types
  React.useEffect(() => {
    devLog.debug('🔍 SalesActivityForm - Income types:', {
      count: incomeTypes?.length || 0,
      types: incomeTypes,
      organizationId
    });
  }, [incomeTypes, organizationId]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: activity ? {
      client_name: activity.client_name || '',
      client_phone: activity.client_phone || '',
      client_email: activity.client_email || '',
      activity_type: activity.activity_type || '',
      income_type_id: activity.income_type_id || '',
      income_category_id: activity.income_category_id || '',
      status: activity.status || 'Active',
      date: activity.date || format(new Date(), 'yyyy-MM-dd'),
      follow_up_date: activity.follow_up_date || '',
      down_payment_amount: activity.down_payment_amount || 0,
      remaining_amount: activity.remaining_amount || 0,
      is_down_payment: activity.is_down_payment || false,
      payment_method: activity.payment_method ? activity.payment_method.toLowerCase() : '',
      is_paid: activity.is_paid || false,
      description: activity.description || '',
      notes: activity.notes || '',
    } : {
      date: format(new Date(), 'yyyy-MM-dd'),
      status: 'Active',
      is_down_payment: false,
      is_paid: false,
    },
  });

  // Set initial selected values for editing and ensure Item Details refetch when opening Edit
  React.useEffect(() => {
    if (activity) {
      setSelectedIncomeType(activity.income_type_id || '');
      setCurrentActivityId(activity.id);
      // Refetch items when opening Edit so Item Details shows saved items (avoid stale empty cache)
      if (activity.id) {
        queryClient.invalidateQueries({ queryKey: ['sales-activity-items', activity.id] });
      }
    }
  }, [activity, activity?.id, queryClient]);

  const downPaymentAmount = watch('down_payment_amount');
  const isDownPayment = watch('is_down_payment');

  // Auto-calculate remaining amount when total from items or down payment changes
  React.useEffect(() => {
    if (totalAmountFromItems !== undefined && downPaymentAmount !== undefined) {
      const remaining = (totalAmountFromItems || 0) - (downPaymentAmount || 0);
      setValue('remaining_amount', Math.max(0, remaining));
    }
  }, [totalAmountFromItems, downPaymentAmount, setValue]);

  // Handler for total amount changes from items
  const handleTotalAmountChange = (total: number) => {
    setTotalAmountFromItems(total);
  };

  const onSubmit = async (data: FormData) => {
    if (readOnly) return;
    if (!organizationId) {
      toast({
        title: "Error",
        description: "No organization selected",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let receiptUrl = null;

      // Upload receipt file if provided
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        // Store under user-id folder to satisfy storage RLS policies
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('income-receipts')
          .upload(filePath, receiptFile);

        if (uploadError) {
          devLog.error('❌ Error uploading receipt:', uploadError);
          throw new Error('Failed to upload receipt file');
        }

        // Get the public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from('income-receipts')
          .getPublicUrl(filePath);

        receiptUrl = publicUrl;
      }

      // Prepare the data for insertion/update with correct field mapping
      const submitData = {
        organization_id: organizationId,
        client_name: data.client_name,
        client_phone: data.client_phone || null,
        client_email: data.client_email || null,
        activity_type: data.activity_type,
        income_type_id: data.income_type_id || null,
        income_category_id: data.income_category_id || null,
        status: data.status,
        date: data.date,
        follow_up_date: data.follow_up_date || null,
        total_amount: totalAmountFromItems || null,
        down_payment_amount: data.down_payment_amount || null,
        remaining_amount: data.remaining_amount || null,
        is_down_payment: data.is_down_payment || false,
        payment_method: data.payment_method || null,
        is_paid: data.is_paid || false,
        description: data.description || null,
        notes: data.notes || null,
        receipt_url: receiptUrl,
        updated_at: new Date().toISOString(),
      };

      if (activity) {
        // Update existing activity
        const { error } = await supabase
          .from('sales_activities')
          .update(submitData)
          .eq('id', activity.id);

        if (error) {
          devLog.error('❌ Error updating sales activity:', error);
          throw error;
        }

        devLog.debug('✅ Sales activity updated successfully');

        // Handle payment history for updates
        const effectiveReceiptUrl = receiptUrl || submitData.receipt_url || undefined;
        
        // Check if down payment increased
        const oldDownPayment = activity.down_payment_amount || 0;
        const newDownPayment = data.down_payment_amount || 0;
        const downPaymentIncrease = newDownPayment - oldDownPayment;
        
        devLog.debug('🔍 Payment update check:', {
          oldDownPayment,
          newDownPayment,
          downPaymentIncrease,
          hasPaymentMethod: !!data.payment_method,
          paymentMethod: data.payment_method
        });
        
        if (downPaymentIncrease > 0 && data.payment_method) {
          devLog.debug('💰 Creating additional down payment history for increase:', downPaymentIncrease);
          
          try {
            // Get current user for created_by
            const { data: { user } } = await supabase.auth.getUser();
            
            // Get current payment count to determine sequence
            const existingPayments = await getPaymentHistory(activity.id);
            const nextSequence = (existingPayments?.length || 0) + 1;
            
            await handleDownPayment(activity.id, {
              payment_amount: downPaymentIncrease,
              payment_date: data.date,
              payment_method: data.payment_method,
              payment_sequence: nextSequence,
              organization_id: organizationId!,
              created_by: user?.id || '',
              receipt_url: effectiveReceiptUrl || null,
              notes: data.notes || null,
            });

            devLog.debug('✅ Additional down payment history created successfully');
          } catch (paymentError) {
            devLog.error('❌ Error creating additional down payment history:', paymentError);
            toast({
              title: "Warning",
              description: "Sales activity updated but failed to create payment history",
              variant: "destructive",
            });
          }
        }
        
        // Check if activity was marked as paid (final payment)
        const wasPaid = activity.is_paid || false;
        const nowPaid = data.is_paid || false;
        const remainingAmount = data.remaining_amount || 0;
        
        if (!wasPaid && nowPaid && remainingAmount > 0 && data.payment_method) {
          devLog.debug('💰 Creating final payment history for remaining amount:', remainingAmount);
          
          try {
            // Get current user for created_by
            const { data: { user } } = await supabase.auth.getUser();
            
            // Get current payment count to determine sequence
            const existingPayments = await getPaymentHistory(activity.id);
            const nextSequence = (existingPayments?.length || 0) + 1;
            
            await handleFinalPayment(activity.id, {
              payment_amount: remainingAmount,
              payment_date: data.date,
              payment_method: data.payment_method,
              payment_sequence: nextSequence,
              organization_id: organizationId!,
              created_by: user?.id || '',
              receipt_url: effectiveReceiptUrl || null,
              notes: data.notes || null,
            });

            devLog.debug('✅ Final payment history created successfully');
          } catch (paymentError) {
            devLog.error('❌ Error creating final payment history:', paymentError);
            toast({
              title: "Warning",
              description: "Sales activity updated but failed to create final payment history",
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Success",
          description: "Sales activity updated successfully",
        });
      } else {
        // Create new activity
        const insertData = {
          ...submitData,
          created_by: user.id,
        };

        const { data: createdActivity, error } = await supabase
          .from('sales_activities')
          .insert(insertData)
          .select()
          .single();
 
        if (error) {
          devLog.error('❌ Error inserting sales activity:', error);
          throw error;
        }

        devLog.debug('✅ Sales activity created successfully');
        setCurrentActivityId(createdActivity.id);

        // Ensure primary service fields are set on the activity from first draft item
        try {
          const draftPayloads = itemsManagerRef.current?.getDraftPayloads?.() || [];
          if (draftPayloads.length > 0) {
            const primary = draftPayloads[0];
            await supabase
              .from('sales_activities')
              .update({
                service_id: primary.service_id || null,
                sub_service_id: primary.sub_service_id || null,
              })
              .eq('id', createdActivity.id);
            devLog.debug('✅ Set service_id and sub_service_id on activity');
          }
        } catch (e) {
          devLog.error('❌ Failed to set primary service on activity:', e);
        }

        // Handle payment history creation based on payment type
        const effectiveReceiptUrl = receiptUrl || createdActivity?.receipt_url || undefined;
        
        devLog.debug('🔍 New activity payment check:', {
          is_down_payment: data.is_down_payment,
          down_payment_amount: data.down_payment_amount,
          payment_method: data.payment_method,
          is_paid: data.is_paid,
          total_amount: totalAmountFromItems
        });
        
        // If down payment is made
        if (data.is_down_payment && data.down_payment_amount && data.down_payment_amount > 0 && data.payment_method) {
          devLog.debug('💰 Creating down payment history and income transaction');
          
          try {
            // Get current user for created_by
            const { data: { user } } = await supabase.auth.getUser();
            
            await handleDownPayment(createdActivity.id, {
              payment_amount: data.down_payment_amount,
              payment_date: data.date,
              payment_method: data.payment_method,
              payment_sequence: 1,
              organization_id: organizationId!,
              created_by: user?.id || '',
              receipt_url: effectiveReceiptUrl || null,
              notes: data.notes || null,
            });

            devLog.debug('✅ Down payment history and income transaction created successfully');

            // If fully paid (remaining amount is 0), also create final payment entry
            if (data.is_paid && data.remaining_amount === 0) {
              // The final payment amount would be 0 in this case, so we skip it
              devLog.debug('📝 Activity fully paid with down payment only');
            }
          } catch (paymentError) {
            devLog.error('❌ Error creating down payment history:', paymentError);
            toast({
              title: "Warning",
              description: "Sales activity created but failed to create payment history",
              variant: "destructive",
            });
          }
        }
        // If activity is marked as fully paid but no down payment (direct full payment)
        else if (data.is_paid && totalAmountFromItems && totalAmountFromItems > 0 && data.payment_method) {
          devLog.debug('💰 Creating full payment history and income transaction');
          
          try {
            // Get current user for created_by
            const { data: { user } } = await supabase.auth.getUser();
            
            await handleFinalPayment(createdActivity.id, {
              payment_amount: totalAmountFromItems,
              payment_date: data.date,
              payment_method: data.payment_method,
              payment_sequence: 1,
              organization_id: organizationId!,
              created_by: user?.id || '',
              receipt_url: effectiveReceiptUrl || null,
              notes: data.notes || null,
            });

            devLog.debug('✅ Full payment history and income transaction created successfully');
          } catch (paymentError) {
            devLog.error('❌ Error creating full payment history:', paymentError);
            toast({
              title: "Warning",
              description: "Sales activity created but failed to create payment history",
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Success",
          description: "Sales activity created successfully",
        });

        // Reset form only for new activities
        reset();
      }
      
      devLog.debug('🎯 Calling onSuccess callback');
      onSuccess();
    } catch (error) {
      devLog.error('Error saving sales activity:', error);
      toast({
        title: "Error",
        description: `Failed to ${activity ? 'update' : 'create'} sales activity`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = getCategoriesByIncomeType(selectedIncomeType);
  const rd = readOnly ? ({ disabled: true } as const) : undefined;

  return (
    <form
      onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit(onSubmit)}
      className="min-w-0 max-w-full space-y-2"
    >
      {masterDataError && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load form options. Please refresh the page.
          </AlertDescription>
        </Alert>
      )}
      {/* Items Manager - Moved to top */}
      <SalesActivityItemsManager
        ref={itemsManagerRef}
        salesActivityId={currentActivityId}
        onTotalChange={readOnly ? undefined : handleTotalAmountChange}
        readOnly={readOnly}
      />

      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 [&>*]:min-w-0">
        {/* Client Information */}
        <Card className="overflow-hidden rounded-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label htmlFor="client_name" className="text-sm">Client Name *</Label>
              <Input
                id="client_name"
                {...register('client_name', rd)}
                placeholder="Enter client name"
                className="mt-1"
              />
              {errors.client_name && (
                <p className="text-sm text-red-500">{errors.client_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="client_phone" className="text-sm">Phone</Label>
              <Input
                id="client_phone"
                {...register('client_phone', rd)}
                placeholder="Enter phone number"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="client_email" className="text-sm">Email</Label>
              <Input
                id="client_email"
                type="email"
                {...register('client_email', rd)}
                placeholder="Enter email address"
                className="mt-1"
              />
              {errors.client_email && (
                <p className="text-sm text-red-500">{errors.client_email.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Details */}
        <Card className="overflow-hidden rounded-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label htmlFor="activity_type" className="text-sm">Activity Type *</Label>
              <Select disabled={readOnly} onValueChange={(value) => setValue('activity_type', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="Demo">Demo</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Call">Call</SelectItem>
                  <SelectItem value="Proposal">Proposal</SelectItem>
                  <SelectItem value="Closing">Closing</SelectItem>
                  <SelectItem value="Lead Conversion">Lead Conversion</SelectItem>
                </SelectContent>
              </Select>
              {errors.activity_type && (
                <p className="text-sm text-red-500">{errors.activity_type.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status" className="text-sm">Status *</Label>
              <Select disabled={readOnly} onValueChange={(value) => setValue('status', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Negotiating">Negotiating</SelectItem>
                  <SelectItem value="Won">Won</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                  <SelectItem value="Follow Up">Follow Up</SelectItem>
                  <SelectItem value="Converted">Converted</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-500">{errors.status.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="date" className="text-sm">Date *</Label>
              <Input
                id="date"
                type="date"
                {...register('date', rd)}
                className="mt-1"
              />
              {errors.date && (
                <p className="text-sm text-red-500">{errors.date.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="follow_up_date" className="text-sm">Follow-up Date</Label>
              <Input
                id="follow_up_date"
                type="date"
                {...register('follow_up_date', rd)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Income Classification */}
        <Card className="overflow-hidden rounded-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Income Classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label htmlFor="income_type_id" className="text-sm">Income Type</Label>
              <Select
                disabled={readOnly}
                onValueChange={(value) => {
                setValue('income_type_id', value);
                setSelectedIncomeType(value);
                setValue('income_category_id', ''); // Reset category when income type changes
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select income type" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {incomeTypesLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : incomeTypes && incomeTypes.length > 0 ? (
                    incomeTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-income-types" disabled>
                      No income types available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="income_category_id" className="text-sm">Income Category</Label>
              <Select
                onValueChange={(value) => setValue('income_category_id', value)}
                disabled={readOnly || !selectedIncomeType}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select income category" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {filteredCategories && filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-categories" disabled>
                      {selectedIncomeType ? 'No categories available' : 'Select income type first'}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card className="overflow-hidden rounded-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-sm">Total Amount (Auto-calculated from items)</Label>
              <Input
                value={`Rp ${totalAmountFromItems.toLocaleString('id-ID')}`}
                readOnly
                className="bg-muted mt-1"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_down_payment"
                checked={isDownPayment}
                disabled={readOnly}
                onCheckedChange={(checked) => setValue('is_down_payment', !!checked)}
              />
              <Label htmlFor="is_down_payment" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Down Payment
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_paid"
                checked={watch('is_paid')}
                disabled={readOnly}
                onCheckedChange={(checked) => setValue('is_paid', !!checked)}
              />
              <Label htmlFor="is_paid" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Mark as Paid
              </Label>
            </div>

            {isDownPayment && (
              <>
                <div>
                  <Label htmlFor="down_payment_amount" className="text-sm">Down Payment Amount</Label>
                  <Input
                    id="down_payment_amount"
                    type="number"
                    step="0.01"
                    {...register('down_payment_amount', { valueAsNumber: true, ...rd })}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="remaining_amount" className="text-sm">Remaining Amount</Label>
                  <Input
                    id="remaining_amount"
                    type="number"
                    step="0.01"
                    {...register('remaining_amount', { valueAsNumber: true, ...rd })}
                    placeholder="0.00"
                    readOnly
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Show payment method and receipt fields when either down payment or full payment */}
            {(isDownPayment || watch('is_paid')) && (
              <>
                <div>
                  <Label htmlFor="payment_method" className="text-sm">Payment Method</Label>
                  <Select disabled={readOnly} onValueChange={(value) => setValue('payment_method', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="receipt" className="text-sm">Receipt Upload</Label>
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/*,.pdf"
                    disabled={readOnly}
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="text-sm mt-1"
                  />
                  {receiptFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {receiptFile.name}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description and Notes */}
      <Card className="min-w-0 overflow-hidden rounded-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label htmlFor="description" className="text-sm">Description</Label>
            <Textarea
              id="description"
              {...register('description', rd)}
              placeholder="Enter activity description"
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes', rd)}
              placeholder="Enter additional notes"
              rows={3}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>


      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-2">
        {readOnly ? (
          <Button type="button" variant="default" onClick={onCancel}>
            Close
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? `${activity ? 'Updating' : 'Creating'}...` : `${activity ? 'Update' : 'Create'} Activity`}
            </Button>
          </>
        )}
      </div>
    </form>
  );
};
