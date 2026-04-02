import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { useIncomeTransactions } from '../hooks';
import { useIncomeMasterData } from '../hooks';
import { CreateIncomeTransactionData } from '../types';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { BankAccountManagementDialog } from './BankAccountManagementDialog';
import { formatInputNumber, parseInputNumber } from '@/shared/lib/pricingInputUtils';
import { isOtherIncomeType } from '@/4-1-dashboard/utils/incomeOtherType';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

const formSchema = z.object({
  transaction_date: z.string().min(1, 'Transaction date is required'),
  amount: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      // If it's already a number, use it
      if (typeof val === 'number') {
        return isNaN(val) ? undefined : val;
      }
      // If it's a string, parse it (remove dots and convert to number)
      if (typeof val === 'string') {
        const numericValue = val.replace(/[^\d]/g, '');
        if (!numericValue) return undefined;
        const num = Number(numericValue);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    },
    z.number().min(0.01, 'Amount must be greater than 0')
  ).refine((val) => val !== undefined, {
    message: 'Amount is required',
  }),
  customer_name: z.string().optional(),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
  income_type_id: z.string().optional(),
  category_id: z.string().optional(),
  custom_category_name: z.string().optional(),
  service_id: z.string().optional(),
  sub_service_id: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurring_frequency: z.string().optional(),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.payment_method === 'bank_transfer') {
    const id = data.bank_account_id?.trim();
    if (!id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a bank account for bank transfer',
        path: ['bank_account_id'],
      });
    }
  }
});

type FormData = z.infer<typeof formSchema>;

interface AddIncomeFormProps {
  onSuccess: () => void;
}

export function AddIncomeForm({ onSuccess }: AddIncomeFormProps) {
  const { t } = useAppTranslation();
  const { createIncomeTransaction, isCreating } = useIncomeTransactions();
  const { incomeTypes, incomeCategories, services, subServices } = useIncomeMasterData();
  const { bankAccounts, refetch: refetchBankAccounts } = useBankAccounts();
  const { refetch: refetchBalances } = useBankAccountBalances();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split('T')[0],
      amount: '' as any,
      is_recurring: false,
    },
  });

  const watchedServiceId = form.watch('service_id');
  const watchedIncomeTypeId = form.watch('income_type_id');
  const watchedIsRecurring = form.watch('is_recurring');

  const filteredSubServices = subServices.filter(
    subService => subService.service_id === watchedServiceId
  );

  const filteredIncomeCategories = incomeCategories.filter(
    category => category.income_types_id === watchedIncomeTypeId
  );

  const selectedIncomeType = useMemo(
    () => incomeTypes.find((t) => t.id === watchedIncomeTypeId),
    [incomeTypes, watchedIncomeTypeId]
  );
  const isOtherIncomeTypeSelected = isOtherIncomeType(selectedIncomeType?.name);

  const onSubmit = (data: FormData) => {
    // Ensure transaction_date is always provided and properly typed
    // Convert amount to number if it's a string (should already be number from parseInputNumber)
    const amountValue = typeof data.amount === 'string' && data.amount !== '' 
      ? parseInputNumber(data.amount)
      : (typeof data.amount === 'number' ? data.amount : 0);
    
    // Helper function to convert empty strings to undefined for UUID fields
    const toUndefinedIfEmpty = (value: string | undefined | null): string | undefined => {
      return value === '' || value === null ? undefined : value;
    };

    const submitIncomeType = incomeTypes.find((t) => t.id === data.income_type_id);
    const otherTypeSelected = isOtherIncomeType(submitIncomeType?.name);

    const transactionData: CreateIncomeTransactionData = {
      transaction_date: data.transaction_date, // This is guaranteed to be a string due to form validation
      amount: amountValue,
      customer_name: data.customer_name || undefined,
      payment_method: data.payment_method || undefined,
      bank_account_id: toUndefinedIfEmpty(data.bank_account_id),
      income_type_id: toUndefinedIfEmpty(data.income_type_id),
      category_id: otherTypeSelected ? undefined : toUndefinedIfEmpty(data.category_id),
      custom_category_name:
        otherTypeSelected && data.custom_category_name?.trim()
          ? data.custom_category_name.trim()
          : undefined,
      service_id: toUndefinedIfEmpty(data.service_id),
      sub_service_id: toUndefinedIfEmpty(data.sub_service_id),
      is_recurring: data.is_recurring,
      recurring_frequency: data.recurring_frequency || undefined,
      description: data.description || undefined,
      receipt_file: receiptFile || undefined,
    };

    createIncomeTransaction(transactionData, {
      onSuccess: () => {
        // Refresh bank account balances after income creation
        refetchBalances();
        form.reset();
        setReceiptFile(null);
        onSuccess();
      }
    });
  };

  const handleBankAccountAdded = () => {
    refetchBankAccounts();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="transaction_date">Transaction Date</Label>
          <Input
            id="transaction_date"
            type="date"
            {...form.register('transaction_date')}
            className="text-sm"
          />
          {form.formState.errors.transaction_date && (
            <p className="text-sm text-red-600">{form.formState.errors.transaction_date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Controller
            name="amount"
            control={form.control}
            render={({ field }) => (
              <Input
                id="amount"
                type="text"
                value={field.value === undefined || field.value === null || field.value === '' 
                  ? '' 
                  : formatInputNumber(field.value)}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    field.onChange('');
                  } else {
                    // Parse the formatted value to get the numeric value
                    const numericValue = parseInputNumber(value);
                    field.onChange(numericValue);
                  }
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                className="text-sm"
                placeholder="0"
              />
            )}
          />
          {form.formState.errors.amount && (
            <p className="text-sm text-red-600">{form.formState.errors.amount.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customer_name">Customer Name</Label>
          <Input
            id="customer_name"
            {...form.register('customer_name')}
            className="text-sm"
            placeholder="Enter customer name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_method">Payment Method</Label>
          <Select
            onValueChange={(value) => {
              form.setValue('payment_method', value, { shouldValidate: true });
              if (value !== 'bank_transfer') {
                form.setValue('bank_account_id', undefined);
              }
            }}
            value={form.watch('payment_method') || undefined}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="debit_card">Debit Card</SelectItem>
              <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_account_id">Bank Account</Label>
        <div className="flex gap-2">
          <Select 
            onValueChange={(value) => form.setValue('bank_account_id', value, { shouldValidate: true })}
            value={form.watch('bank_account_id') || undefined}
          >
            <SelectTrigger className="text-sm flex-1">
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((bankAccount) => (
                <SelectItem key={bankAccount.id} value={bankAccount.id}>
                  {bankAccount.name} {bankAccount.account_number ? `(${bankAccount.account_number})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.formState.errors.bank_account_id && (
          <p className="text-sm text-red-600">{form.formState.errors.bank_account_id.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="income_type_id">Income Type</Label>
          <Select
            value={watchedIncomeTypeId || undefined}
            onValueChange={(value) => {
              form.setValue('income_type_id', value);
              form.setValue('category_id', undefined); // Reset category when income type changes
              const next = incomeTypes.find((typeRow) => typeRow.id === value);
              if (!isOtherIncomeType(next?.name)) {
                form.setValue('custom_category_name', '');
              }
            }}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select income type" />
            </SelectTrigger>
            <SelectContent>
              {incomeTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={isOtherIncomeTypeSelected ? 'custom_category_name' : 'category_id'}>Category</Label>
          {isOtherIncomeTypeSelected ? (
            <Input
              id="custom_category_name"
              className="text-sm"
              placeholder={t('incomes.categoryCustomPlaceholder', 'e.g. THR, bonus, gift')}
              disabled={!watchedIncomeTypeId}
              {...form.register('custom_category_name')}
            />
          ) : (
            <Select
              onValueChange={(value) => form.setValue('category_id', value)}
              disabled={!watchedIncomeTypeId}
              value={form.watch('category_id') || undefined}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {filteredIncomeCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="service_id">Service</Label>
          <Select
            value={watchedServiceId || undefined}
            onValueChange={(value) => {
              form.setValue('service_id', value);
              form.setValue('sub_service_id', undefined); // Reset sub-service when service changes
            }}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sub_service_id">Sub Service</Label>
          <Select
            value={form.watch('sub_service_id') || undefined}
            onValueChange={(value) => form.setValue('sub_service_id', value)}
            disabled={!watchedServiceId}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select sub service" />
            </SelectTrigger>
            <SelectContent>
              {filteredSubServices.map((subService) => (
                <SelectItem key={subService.id} value={subService.id}>
                  {subService.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_recurring"
            checked={watchedIsRecurring}
            onCheckedChange={(checked) => form.setValue('is_recurring', checked as boolean)}
          />
          <Label htmlFor="is_recurring" className="text-sm">Recurring Transaction</Label>
        </div>
      </div>

      {watchedIsRecurring && (
        <div className="space-y-2">
          <Label htmlFor="recurring_frequency">Recurring Frequency</Label>
          <Select
            value={form.watch('recurring_frequency') || undefined}
            onValueChange={(value) => form.setValue('recurring_frequency', value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...form.register('description')}
          className="text-sm"
          placeholder="Enter transaction description"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="receipt">Receipt File</Label>
        <Input
          id="receipt"
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Transaction'}
        </Button>
      </div>

      <BankAccountManagementDialog
        open={isBankAccountDialogOpen}
        onClose={() => setIsBankAccountDialogOpen(false)}
        onBankAccountAdded={handleBankAccountAdded}
        onBankAccountSelect={(bankAccountId) => {
          form.setValue('bank_account_id', bankAccountId);
          setIsBankAccountDialogOpen(false);
        }}
      />
    </form>
  );
}
