import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useIncomeTransactions, useIncomeMasterData } from '../hooks';
import type { IncomeTransactionWithRelations } from '../types';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { isOtherIncomeType } from '@/4-1-dashboard/utils/incomeOtherType';
import { isIncomeAllocationIncomplete } from '@/4-1-dashboard/utils/incomeAllocationStatus';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { getIncomeTransactionIdDisplay } from '@/4-1-dashboard/utils/incomeTransactionDisplayId';
import {
  MODAL_BRAND_HEADER_BAR,
  MODAL_BRAND_HEADER_CLOSE_BTN,
} from '@/shared/constants/modalBrandHeaderClasses';

const allocationSchema = z
  .object({
    income_type_id: z.string().min(1, 'Income type is required'),
    category_id: z.string().optional(),
    custom_category_name: z.string().optional(),
    bank_account_id: z.string().min(1, 'Bank account is required'),
  })
  .superRefine((data, ctx) => {
    if (!data.bank_account_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bank account is required',
        path: ['bank_account_id'],
      });
    }
  });

type AllocationFormValues = z.infer<typeof allocationSchema>;

interface IncomeAllocationDialogProps {
  income: IncomeTransactionWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncomeAllocationDialog({ income, open, onOpenChange }: IncomeAllocationDialogProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { updateIncomeTransactionAsync, isUpdating } = useIncomeTransactions();
  const { incomeTypes, incomeCategories } = useIncomeMasterData();
  const { bankAccounts } = useBankAccounts({ includeInactive: true });

  const lockFinancial = !!(income?.has_income_allocations);
  const lockBankInAllocation =
    !!income?.bank_account_id?.trim() &&
    !!income &&
    isIncomeAllocationIncomplete({
      income_type_id: income.income_type_id,
      category_id: income.category_id,
      bank_account_id: income.bank_account_id,
    });

  const bankAccountSelectOptions = useMemo(() => {
    const rows = bankAccounts.map((b) => ({
      id: b.id,
      label: `${b.name}${b.account_number ? ` (${b.account_number})` : ''}`,
    }));
    const linkedId = income?.bank_account_id?.trim();
    if (!linkedId || rows.some((r) => r.id === linkedId)) {
      return rows;
    }
    const rel = income?.bank_accounts;
    const label =
      rel?.name != null && String(rel.name).length > 0
        ? `${rel.name}${rel.account_number ? ` (${rel.account_number})` : ''}`
        : 'Previously selected account';
    return [{ id: linkedId, label }, ...rows];
  }, [bankAccounts, income]);

  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      income_type_id: '',
      category_id: '',
      custom_category_name: '',
      bank_account_id: '',
    },
  });

  useEffect(() => {
    if (!open || !income) return;
    const typeName = income.income_types?.name;
    const otherSaved = isOtherIncomeType(typeName);
    form.reset({
      income_type_id: income.income_type_id || '',
      category_id: income.category_id || '',
      custom_category_name: otherSaved ? (income.income_categories?.name ?? '') : '',
      bank_account_id: income.bank_account_id?.trim() || '',
    });
  }, [income, open, form]);

  const watchedIncomeTypeId = form.watch('income_type_id');
  const selectedIncomeType = useMemo(
    () => incomeTypes.find((row) => row.id === watchedIncomeTypeId),
    [incomeTypes, watchedIncomeTypeId],
  );
  const isOtherIncomeTypeSelected = isOtherIncomeType(selectedIncomeType?.name);

  const filteredIncomeCategories = useMemo(
    () => incomeCategories.filter((c) => c.income_types_id === watchedIncomeTypeId),
    [incomeCategories, watchedIncomeTypeId],
  );

  const onSubmit = async (values: AllocationFormValues) => {
    if (!income) return;
    const submitType = incomeTypes.find((row) => row.id === values.income_type_id);
    const otherSelected = isOtherIncomeType(submitType?.name);
    if (otherSelected && !values.custom_category_name?.trim()) {
      form.setError('custom_category_name', {
        message: t('incomes.allocation.categoryRequired', 'Category is required'),
      });
      return;
    }
    if (!otherSelected && !values.category_id?.trim()) {
      form.setError('category_id', {
        message: t('incomes.allocation.categoryRequired', 'Category is required'),
      });
      return;
    }

    try {
      await updateIncomeTransactionAsync({
        id: income.id,
        income_type_id: values.income_type_id,
        bank_account_id: values.bank_account_id.trim(),
        ...(otherSelected
          ? { custom_category_name: values.custom_category_name ?? '' }
          : { category_id: values.category_id }),
      });
      onOpenChange(false);
    } catch {
      // Toast handled in hook
    }
  };

  if (!income) return null;

  const { display: txIdDisplay } = getIncomeTransactionIdDisplay(income);
  const txDate =
    typeof income.transaction_date === 'string' && income.transaction_date.length >= 10
      ? income.transaction_date.slice(0, 10)
      : income.transaction_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 h-dvh min-h-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden'
            : 'max-w-lg max-h-[90vh] w-full flex flex-col p-0 gap-0 overflow-hidden sm:rounded-lg',
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 text-left',
            MODAL_BRAND_HEADER_BAR,
            isMobile
              ? 'safe-area-top flex flex-row flex-nowrap items-stretch gap-0 space-y-0 px-0 py-0 !space-y-0'
              : 'space-y-1 px-4 py-3',
          )}
        >
          {isMobile ? (
            <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
              <DialogTitle className="m-0 min-w-0 flex-1 truncate py-0 pr-1 text-base font-semibold leading-tight text-primary-foreground">
                {t('incomes.allocation.title', 'Allocate income')}
              </DialogTitle>
              <button
                type="button"
                className={MODAL_BRAND_HEADER_CLOSE_BTN}
                onClick={() => onOpenChange(false)}
                aria-label={t('layout.sheetClose', 'Close')}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </div>
          ) : (
            <DialogTitle className="text-lg font-semibold leading-tight text-primary-foreground">
              {t('incomes.allocation.title', 'Allocate income')}
            </DialogTitle>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                'scrollbar-hide seamless-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                isMobile ? 'px-4 py-4' : 'px-6 py-4',
              )}
            >
              <p className="text-sm text-muted-foreground">
                {t(
                  'incomes.allocation.subtitle',
                  '{{amount}} · {{date}} · {{id}}',
                  {
                    amount: formatToRupiah(income.amount),
                    date: format(new Date(txDate), 'dd MMM yyyy'),
                    id: txIdDisplay,
                  },
                )}
              </p>

              <Alert>
                <AlertDescription className="text-sm">
                  {t(
                    'incomes.allocation.hintNoBalanceUntilBank',
                    'This payment is not credited to any bank balance until you select a bank account. Type and category are required to mark the transaction complete.',
                  )}
                </AlertDescription>
              </Alert>

              {lockFinancial ? (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    {t(
                      'incomes.edit.lockedFinancialHint',
                      'This income is linked to an expense or debt payment. Amount, account, and classification fields are locked until that payment is removed or changed.',
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('incomes.customer', 'Customer')}
                  </Label>
                  <p className="font-medium">{income.customer_name || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('incomes.paymentMethod', 'Payment method')}
                  </Label>
                  <p>{income.payment_method || '—'}</p>
                </div>
                {(income.services?.name || income.sub_services?.name) && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('incomes.service', 'Service')}
                    </Label>
                    <p>
                      {[income.services?.name, income.sub_services?.name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}
                {income.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('common.description', 'Description')}
                    </Label>
                    <p className="break-words">{income.description}</p>
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="income_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('incomes.incomeType', 'Income type')} <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('category_id', '');
                        const next = incomeTypes.find((row) => row.id === value);
                        if (!isOtherIncomeType(next?.name)) {
                          form.setValue('custom_category_name', '');
                        }
                      }}
                      value={field.value || undefined}
                      disabled={lockFinancial}
                    >
                      <FormControl>
                        <SelectTrigger disabled={lockFinancial}>
                          <SelectValue placeholder={t('incomes.selectIncomeType', 'Select income type')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {incomeTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isOtherIncomeTypeSelected ? (
                <FormField
                  control={form.control}
                  name="custom_category_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('common.category', 'Category')} <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('incomes.categoryCustomPlaceholder', 'e.g. THR, bonus, gift')}
                          disabled={lockFinancial || !watchedIncomeTypeId}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('common.category', 'Category')} <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={lockFinancial || !watchedIncomeTypeId}
                      >
                        <FormControl>
                          <SelectTrigger disabled={lockFinancial || !watchedIncomeTypeId}>
                            <SelectValue placeholder={t('incomes.selectCategory', 'Select category')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredIncomeCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="bank_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('incomes.bankAccount', 'Bank account')} <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={lockFinancial || lockBankInAllocation}
                    >
                      <FormControl>
                        <SelectTrigger disabled={lockFinancial || lockBankInAllocation}>
                          <SelectValue placeholder={t('incomes.selectBankAccount', 'Select bank account')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bankAccountSelectOptions.map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lockBankInAllocation ? (
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'incomes.allocation.bankPresetLocked',
                          'Bank account was set from livechat conversion and cannot be changed here.',
                        )}
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div
              className={cn(
                'flex flex-shrink-0 gap-2 border-t border-border bg-background',
                isMobile ? 'safe-area-bottom px-4 py-3' : 'px-6 py-4',
              )}
            >
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isUpdating || lockFinancial}
              >
                {t('incomes.allocation.saveAndComplete', 'Save & complete')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
