import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CalendarIcon, Check, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/shared/components/ui/drawer';
import { Debt, CreateDebtData, DEBT_TYPES } from '../types';
import { formatInputNumber, parseInputNumber } from '../utils/numberFormat';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

// Schema will be created dynamically inside component to use translation
type DebtFormData = {
  debt_name: string;
  debt_type: string;
  bank_name?: string;
  limit_amount: number;
  available_limit?: number;
  amountReceived?: number; // Hanya untuk Pinjaman Online (Jumlah Diterima)
  debt_amount: number;
  paid_amount?: number;
  loan_duration?: number;
  monthly_payment?: number;
  interest_rate?: number;
  due_date?: string;
  minimum_payment?: number;
  description?: string;
  status?: 'active' | 'paid_off' | 'closed';
};

interface DebtFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDebtData) => Promise<boolean>;
  initialData?: Debt;
  isLoading?: boolean;
}

export const DebtForm = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData,
  isLoading = false 
}: DebtFormProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const isEditMode = !!initialData;
  
  // Create schema dynamically to use translation
  const debtSchema = z.object({
    debt_name: z.string().min(1, t('debt.form.debtName', 'Debt Name') + ' is required'),
    debt_type: z.string().min(1, t('debt.form.debtType', 'Debt Type') + ' must be selected'),
    bank_name: z.string().optional(),
    limit_amount: z.number().min(0, t('debt.form.limitPlafon', 'Limit/Plafon') + ' must be greater than 0'),
    available_limit: z.number().min(0).optional(),
    amountReceived: z.number().min(0).optional(), // Pinjaman Online: Jumlah Diterima
    debt_amount: z.number().min(0, t('debt.form.actualDebt', 'Actual Debt') + ' must be greater than 0'),
    paid_amount: z.number().min(0).optional(),
    loan_duration: z.number().min(1).optional(),
    monthly_payment: z.number().min(0).optional(),
    interest_rate: z.number().min(0).max(100).optional(),
    due_date: z.string().optional(),
    minimum_payment: z.number().min(0).optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'paid_off', 'closed']).optional(),
  }).refine((data) => {
    if (data.debt_type === 'Pinjaman Online') {
      return (data.limit_amount ?? 0) > 0;
    }
    return true;
  }, {
    message: t('debt.form.totalLimit', 'Total Limit') + ' is required for Online Loan',
    path: ['limit_amount'],
  }).refine((data) => {
    if (data.debt_type === 'Pinjaman Online') return true;
    if (data.available_limit !== undefined && data.available_limit !== null) {
      return data.available_limit <= data.limit_amount;
    }
    return true;
  }, {
    message: t('debt.form.availableLimit', 'Available Limit') + ' cannot exceed ' + t('debt.form.limitPlafon', 'Limit/Plafon'),
    path: ['available_limit'],
  });
  
  // State for formatted display values
  const [limitAmountDisplay, setLimitAmountDisplay] = useState('');
  const [availableLimitDisplay, setAvailableLimitDisplay] = useState('');
  const [amountReceivedDisplay, setAmountReceivedDisplay] = useState(''); // Pinjaman Online only
  const [debtAmountDisplay, setDebtAmountDisplay] = useState('');
  const [interestRateDisplay, setInterestRateDisplay] = useState('');
  const [minimumPaymentDisplay, setMinimumPaymentDisplay] = useState('');
  const [loanDurationDisplay, setLoanDurationDisplay] = useState('');
  const [monthlyPaymentDisplay, setMonthlyPaymentDisplay] = useState('');
  const [debtTypeDrawerOpen, setDebtTypeDrawerOpen] = useState(false);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  
  const form = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      debt_name: '',
      debt_type: '',
      bank_name: '',
      limit_amount: 0,
      available_limit: undefined,
      amountReceived: undefined,
      debt_amount: 0,
      paid_amount: undefined,
      loan_duration: undefined,
      monthly_payment: undefined,
      interest_rate: undefined,
      due_date: undefined,
      minimum_payment: undefined,
      description: '',
      status: 'active',
    },
  });

  useEffect(() => {
    if (initialData) {
      // Pinjaman Online: limit_amount = Total Limit, debt_amount = total used for expense, available_limit = sisa plafon
      const isOnline = initialData.debt_type === 'Pinjaman Online';
      form.reset({
        debt_name: initialData.debt_name,
        debt_type: initialData.debt_type,
        bank_name: initialData.bank_name || '',
        limit_amount: initialData.limit_amount,
        available_limit: initialData.available_limit || undefined,
        amountReceived: isOnline ? initialData.limit_amount : undefined,
        debt_amount: initialData.debt_amount,
        paid_amount: initialData.paid_amount || undefined,
        loan_duration: initialData.loan_duration || undefined,
        monthly_payment: initialData.monthly_payment || undefined,
        interest_rate: initialData.interest_rate || undefined,
        due_date: initialData.due_date || undefined,
        minimum_payment: initialData.minimum_payment || undefined,
        description: initialData.description || '',
        status: initialData.status,
      });
      setLimitAmountDisplay(formatInputNumber(initialData.limit_amount));
      setAvailableLimitDisplay(formatInputNumber(initialData.available_limit || ''));
      setAmountReceivedDisplay(formatInputNumber(isOnline ? initialData.limit_amount : ''));
      setDebtAmountDisplay(formatInputNumber(initialData.debt_amount));
      setInterestRateDisplay(initialData.interest_rate ? initialData.interest_rate.toString() : '');
      setMinimumPaymentDisplay(formatInputNumber(initialData.minimum_payment || ''));
      setLoanDurationDisplay(initialData.loan_duration ? initialData.loan_duration.toString() : '');
      setMonthlyPaymentDisplay(formatInputNumber(initialData.monthly_payment || ''));
    } else {
      form.reset({
        debt_name: '',
        debt_type: '',
        bank_name: '',
        limit_amount: 0,
        available_limit: undefined,
        amountReceived: undefined,
        debt_amount: 0,
        paid_amount: undefined,
        loan_duration: undefined,
        monthly_payment: undefined,
        interest_rate: undefined,
        due_date: undefined,
        minimum_payment: undefined,
        description: '',
        status: 'active',
      });
      setLimitAmountDisplay('');
      setAvailableLimitDisplay('');
      setAmountReceivedDisplay('');
      setDebtAmountDisplay('');
      setInterestRateDisplay('');
      setMinimumPaymentDisplay('');
      setLoanDurationDisplay('');
      setMonthlyPaymentDisplay('');
    }
  }, [initialData, isOpen]);

  const limitAmount = form.watch('limit_amount');
  const availableLimit = form.watch('available_limit');
  const amountReceived = form.watch('amountReceived');
  const debtAmount = form.watch('debt_amount');
  const interestRate = form.watch('interest_rate');
  const minimumPayment = form.watch('minimum_payment');
  const loanDuration = form.watch('loan_duration');
  const monthlyPayment = form.watch('monthly_payment');
  const debtType = form.watch('debt_type');
  const isOnlineLoan = debtType === 'Pinjaman Online';

  // Update display values when form values change
  // Only update if value is greater than 0 to avoid showing "0" in empty fields
  useEffect(() => {
    if (limitAmount !== undefined && limitAmount !== null && limitAmount > 0) {
      setLimitAmountDisplay(formatInputNumber(limitAmount));
    } else if (limitAmount === 0) {
      // Keep empty string if value is 0 (default or cleared)
      setLimitAmountDisplay('');
    }
  }, [limitAmount]);

  useEffect(() => {
    if (availableLimit !== undefined && availableLimit !== null && availableLimit > 0) {
      setAvailableLimitDisplay(formatInputNumber(availableLimit));
    } else {
      setAvailableLimitDisplay('');
    }
  }, [availableLimit]);

  useEffect(() => {
    if (amountReceived !== undefined && amountReceived !== null && amountReceived > 0) {
      setAmountReceivedDisplay(formatInputNumber(amountReceived));
    } else {
      setAmountReceivedDisplay('');
    }
  }, [amountReceived]);

  useEffect(() => {
    if (debtAmount !== undefined && debtAmount !== null && debtAmount > 0) {
      setDebtAmountDisplay(formatInputNumber(debtAmount));
    } else if (debtAmount === 0) {
      // Keep empty string if value is 0 (default or cleared)
      setDebtAmountDisplay('');
    }
  }, [debtAmount]);

  useEffect(() => {
    if (interestRate !== undefined && interestRate !== null && interestRate > 0) {
      setInterestRateDisplay(interestRate.toString());
    } else {
      setInterestRateDisplay('');
    }
  }, [interestRate]);

  useEffect(() => {
    if (minimumPayment !== undefined && minimumPayment !== null && minimumPayment > 0) {
      setMinimumPaymentDisplay(formatInputNumber(minimumPayment));
    } else {
      setMinimumPaymentDisplay('');
    }
  }, [minimumPayment]);

  // Auto-calculate monthly_payment when loan_duration and limit_amount are filled for Pinjaman Online
  useEffect(() => {
    if (isOnlineLoan && loanDuration && loanDuration > 0 && limitAmount && limitAmount > 0) {
      const calculatedMonthly = limitAmount / loanDuration;
      // Only update if monthly_payment is not manually set or is empty
      if (!monthlyPayment || monthlyPayment === 0) {
        form.setValue('monthly_payment', calculatedMonthly, { shouldValidate: true });
        setMonthlyPaymentDisplay(formatInputNumber(calculatedMonthly));
      }
    }
  }, [loanDuration, limitAmount, isOnlineLoan, monthlyPayment, form]);

  // Auto-calculate debt_amount and available_limit when limit_amount changes (non-Pinjaman Online)
  // Pinjaman Online: debt_amount dan available_limit dari DB/trigger, tidak di-set dari form saat add (create pakai 0 dan limit_amount)
  useEffect(() => {
    if (isOnlineLoan) {
      // Saat add new: available_limit = limit_amount (sama), debt_amount = 0 (useDebts create akan set)
      if (!initialData && limitAmount && limitAmount > 0) {
        form.setValue('available_limit', limitAmount, { shouldValidate: true });
        setAvailableLimitDisplay(formatInputNumber(limitAmount));
        form.setValue('debt_amount', 0, { shouldValidate: true });
        setDebtAmountDisplay('0');
      }
    } else {
      // For other debt types: auto-fill available_limit dengan limit_amount jika belum ada pemakaian
      const limit = limitAmount || 0;
      if (limit > 0) {
        const currentAvailableLimit = availableLimit;
        // Auto-fill available_limit dengan limit_amount jika belum diisi (belum ada pemakaian)
        if (currentAvailableLimit === undefined || currentAvailableLimit === null || currentAvailableLimit === 0) {
          form.setValue('available_limit', limit, { shouldValidate: true });
          setAvailableLimitDisplay(formatInputNumber(limit));
        }
        // Calculate debt_amount dari available_limit
        const available = currentAvailableLimit ?? limit;
        const terpakai = Math.max(0, limit - available);
        form.setValue('debt_amount', terpakai, { shouldValidate: true });
      }
    }
  }, [limitAmount, isOnlineLoan, debtAmount, availableLimit, form]);

  const handleSubmit = async (data: DebtFormData) => {
    let finalAvailableLimit = data.available_limit;
    let finalDebtAmount = data.debt_amount;
    let finalPaidAmount: number | undefined = undefined;
    
    if (data.debt_type === 'Pinjaman Online') {
      // Create: limit_amount = Total Limit, available_limit = limit_amount, debt_amount = 0 (useDebts will set)
      // Edit: limit_amount bisa diubah; debt_amount/paid_amount/available_limit dari DB (useDebts update keeps them)
      finalDebtAmount = initialData?.debt_amount ?? 0;
      finalAvailableLimit = initialData ? (data.available_limit ?? initialData.available_limit) : data.limit_amount;
      finalPaidAmount = initialData?.paid_amount ?? 0;
    } else {
      if (data.available_limit !== undefined && data.available_limit !== null) {
        finalAvailableLimit = data.available_limit;
        finalDebtAmount = data.limit_amount - data.available_limit;
      } else {
        finalAvailableLimit = data.limit_amount; // full limit available
        finalDebtAmount = 0;
      }
      finalPaidAmount = data.paid_amount;
    }
    
    const payloadLimitAmount = data.limit_amount; // Total Limit untuk Pinjaman Online, limit/plafon untuk lainnya
    const success = await onSubmit({
      ...data,
      limit_amount: payloadLimitAmount,
      available_limit: finalAvailableLimit,
      debt_amount: finalDebtAmount,
      paid_amount: finalPaidAmount,
      loan_duration: data.loan_duration,
      monthly_payment: data.monthly_payment,
    } as CreateDebtData);
    
    if (success) {
      form.reset();
      onClose();
    }
  };

  const selectedDueDate = form.watch('due_date') 
    ? new Date(form.watch('due_date')!) 
    : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "w-[95vw] sm:w-[600px] sm:h-[600px] max-w-[600px] max-h-[90vh] p-0 overflow-hidden flex flex-col min-w-0"
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        {isMobile ? (
          <DialogHeader className="flex min-h-[3.25rem] flex-shrink-0 flex-row items-center justify-between gap-3 space-y-0 border-b bg-gradient-to-r from-brand-blue/10 to-brand-blue/5 px-4 py-2 text-left safe-area-top dark:from-brand-blue/20 dark:to-brand-blue/10">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left text-base font-semibold leading-tight">
                {isEditMode ? t('debt.form.editTitle', 'Edit Debt') : t('debt.form.addTitle', 'Add New Debt')}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-left text-xs leading-snug text-muted-foreground">
                {isEditMode
                  ? t('debt.form.editDescription', 'Update your debt information')
                  : t('debt.form.addDescription', 'Enter debt details to be added')}
              </DialogDescription>
            </div>
            <DialogClose
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">{t('common.close', 'Close')}</span>
            </DialogClose>
          </DialogHeader>
        ) : (
          <DialogHeader className="flex-shrink-0 border-b p-4 pb-2">
            <DialogTitle className="text-lg font-semibold">
              {isEditMode ? t('debt.form.editTitle', 'Edit Debt') : t('debt.form.addTitle', 'Add New Debt')}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? t('debt.form.editDescription', 'Update your debt information')
                : t('debt.form.addDescription', 'Enter debt details to be added')}
            </DialogDescription>
          </DialogHeader>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll px-4 py-4 space-y-4 [-ms-overflow-style:none] [scrollbar-width:none] scrollbar-hide [&::-webkit-scrollbar]:hidden">
            <div>
              <Label htmlFor="debt_name">
                {t('debt.form.debtName', 'Debt Name')} <span className="text-brand-red">*</span>
              </Label>
              <Input
                id="debt_name"
                {...form.register('debt_name')}
                placeholder={t('debt.form.debtNamePlaceholder', 'Example: Credit Card Jenius')}
                className="mt-1 text-sm placeholder:text-sm"
              />
              {form.formState.errors.debt_name && (
                <p className="text-sm text-brand-red mt-1">
                  {form.formState.errors.debt_name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="debt_type">
                {t('debt.form.debtType', 'Debt Type')} <span className="text-brand-red">*</span>
              </Label>
              {isMobile ? (
                <Drawer open={debtTypeDrawerOpen} onOpenChange={setDebtTypeDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "mt-1 w-full justify-between text-sm font-normal",
                        !form.watch('debt_type') && "text-muted-foreground"
                      )}
                    >
                      <span className="truncate">
                        {form.watch('debt_type')
                          ? (
                              form.watch('debt_type') === 'Kartu Kredit' ? t('debt.type.creditCard', 'Credit Card') :
                              form.watch('debt_type') === 'Pinjaman Bank' ? t('debt.type.bankLoan', 'Bank Loan') :
                              form.watch('debt_type') === 'Hutang Supplier' ? t('debt.type.supplierDebt', 'Supplier Debt') :
                              form.watch('debt_type') === 'Pinjaman Online' ? t('debt.type.onlineLoan', 'Online Loan') :
                              form.watch('debt_type') === 'Hutang Pribadi' ? t('debt.type.personalDebt', 'Personal Debt') :
                              t('debt.type.other', 'Other')
                            )
                          : t('debt.form.selectDebtType', 'Select debt type')}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent overlayClassName="z-[60]" className="z-[60] max-h-[85dvh] flex flex-col">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold">
                        {t('debt.form.debtType', 'Debt Type')}
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {DEBT_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              form.setValue('debt_type', type);
                              const currentLimitAmount = form.getValues('limit_amount');
                              if (currentLimitAmount > 0) {
                                if (type === 'Pinjaman Online') {
                                  form.setValue('available_limit', currentLimitAmount);
                                  form.setValue('debt_amount', 0);
                                  setAvailableLimitDisplay(formatInputNumber(currentLimitAmount));
                                  setDebtAmountDisplay('0');
                                } else {
                                  form.setValue('available_limit', currentLimitAmount);
                                  setAvailableLimitDisplay(formatInputNumber(currentLimitAmount));
                                }
                              }
                              setDebtTypeDrawerOpen(false);
                            }}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              form.watch('debt_type') === type ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">
                              {type === 'Kartu Kredit' ? t('debt.type.creditCard', 'Credit Card') :
                               type === 'Pinjaman Bank' ? t('debt.type.bankLoan', 'Bank Loan') :
                               type === 'Hutang Supplier' ? t('debt.type.supplierDebt', 'Supplier Debt') :
                               type === 'Pinjaman Online' ? t('debt.type.onlineLoan', 'Online Loan') :
                               type === 'Hutang Pribadi' ? t('debt.type.personalDebt', 'Personal Debt') :
                               t('debt.type.other', 'Other')}
                            </span>
                            {form.watch('debt_type') === type ? <Check className="h-4 w-4 text-primary shrink-0" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-end gap-2">
                      <DrawerClose asChild>
                        <Button size="sm" className="min-w-[100px]">
                          {t('common.done', 'Done')}
                        </Button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Select
                  value={form.watch('debt_type')}
                  onValueChange={(value) => {
                    form.setValue('debt_type', value);
                    const currentLimitAmount = form.getValues('limit_amount');
                    if (currentLimitAmount > 0) {
                      if (value === 'Pinjaman Online') {
                        form.setValue('available_limit', currentLimitAmount);
                        form.setValue('debt_amount', 0);
                        setAvailableLimitDisplay(formatInputNumber(currentLimitAmount));
                        setDebtAmountDisplay('0');
                      } else {
                        form.setValue('available_limit', currentLimitAmount);
                        setAvailableLimitDisplay(formatInputNumber(currentLimitAmount));
                      }
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue placeholder={t('debt.form.selectDebtType', 'Select debt type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {DEBT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === 'Kartu Kredit' ? t('debt.type.creditCard', 'Credit Card') :
                         type === 'Pinjaman Bank' ? t('debt.type.bankLoan', 'Bank Loan') :
                         type === 'Hutang Supplier' ? t('debt.type.supplierDebt', 'Supplier Debt') :
                         type === 'Pinjaman Online' ? t('debt.type.onlineLoan', 'Online Loan') :
                         type === 'Hutang Pribadi' ? t('debt.type.personalDebt', 'Personal Debt') :
                         t('debt.type.other', 'Other')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.debt_type && (
                <p className="text-sm text-brand-red mt-1">
                  {form.formState.errors.debt_type.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="bank_name">{t('debt.form.bankInstitution', 'Bank/Institution')}</Label>
              <Input
                id="bank_name"
                {...form.register('bank_name')}
                placeholder={t('debt.form.bankPlaceholder', 'Example: Jenius, BCA, Mandiri')}
                className="mt-1 text-sm placeholder:text-sm"
              />
            </div>

            {isOnlineLoan ? (
              // Fields for Pinjaman Online: Total Limit = Available Limit ketika belum dipakai; Debt/Paid terisi otomatis dari expense dan Pay Debt
              <>
                <div>
                  <Label htmlFor="limit_amount">
                    {t('debt.form.totalLimit', 'Total Limit (Rp)')} <span className="text-brand-red">*</span>
                  </Label>
                  <Input
                    id="limit_amount"
                    type="text"
                    value={limitAmountDisplay}
                    onChange={(e) => {
                      const formatted = formatInputNumber(e.target.value);
                      setLimitAmountDisplay(formatted);
                      const parsed = parseInputNumber(formatted);
                      form.setValue('limit_amount', parsed ?? 0, { shouldValidate: true });
                    }}
                    placeholder=""
                    className="mt-1 text-sm placeholder:text-sm"
                  />
                  {form.formState.errors.limit_amount && (
                    <p className="text-sm text-brand-red mt-1">
                      {form.formState.errors.limit_amount.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {t('debt.form.totalLimitDesc', 'When not used, Available Limit equals Total Limit. Debt and Paid fill automatically from expenses and Pay Debt.')}
                  </p>
                </div>

                {isEditMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-500">{t('debt.table.availableLimit', 'Available Limit')}</Label>
                      <p className="mt-1 text-sm font-medium">{availableLimitDisplay || '0'}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('debt.form.availableLimitDesc', 'Remaining credit (read-only)')}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">{t('debt.table.debt', 'Debt')}</Label>
                      <p className="mt-1 text-sm font-medium text-brand-red">{debtAmountDisplay || '0'}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('debt.form.debtFromExpense', 'From expenses (read-only)')}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">{t('debt.table.paid', 'Paid')}</Label>
                      <p className="mt-1 text-sm font-medium text-brand-blue">{formatInputNumber(initialData?.paid_amount ?? 0) || '0'}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('debt.form.paidFromModal', 'From Pay Debt (read-only)')}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="loan_duration">
                      {t('debt.form.loanDuration', 'Loan Duration (Months)')}
                    </Label>
                    <Input
                      id="loan_duration"
                      type="number"
                      value={loanDurationDisplay}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLoanDurationDisplay(value);
                        const parsed = value ? parseInt(value, 10) : undefined;
                        form.setValue('loan_duration', parsed, { shouldValidate: true });
                        
                        // Auto-calculate monthly payment if both loan_duration and limit_amount are filled
                        if (parsed && parsed > 0 && limitAmount > 0) {
                          const calculatedMonthly = limitAmount / parsed;
                          form.setValue('monthly_payment', calculatedMonthly);
                          setMonthlyPaymentDisplay(formatInputNumber(calculatedMonthly));
                        }
                      }}
                      placeholder=""
                      className="mt-1 text-sm placeholder:text-sm"
                      min="1"
                    />
                    {form.formState.errors.loan_duration && (
                      <p className="text-sm text-brand-red mt-1">
                        {form.formState.errors.loan_duration.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {t('debt.form.loanDurationDesc', 'Loan duration in months')}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="monthly_payment">
                      {t('debt.form.monthlyPayment', 'Monthly Payment (Rp)')}
                    </Label>
                    <Input
                      id="monthly_payment"
                      type="text"
                      value={monthlyPaymentDisplay}
                      onChange={(e) => {
                        const formatted = formatInputNumber(e.target.value);
                        setMonthlyPaymentDisplay(formatted);
                        const parsed = parseInputNumber(formatted);
                        form.setValue('monthly_payment', parsed || undefined, { shouldValidate: true });
                      }}
                      placeholder=""
                      className="mt-1 text-sm placeholder:text-sm"
                    />
                    {form.formState.errors.monthly_payment && (
                      <p className="text-sm text-brand-red mt-1">
                        {form.formState.errors.monthly_payment.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {t('debt.form.monthlyPaymentDesc', 'Amount of monthly payment (automatically calculated if loan duration is filled)')}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              // Fields for other debt types
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="limit_amount">
                      {t('debt.form.limitPlafon', 'Limit/Plafon (Rp)')} <span className="text-brand-red">*</span>
                    </Label>
                    <Input
                      id="limit_amount"
                      type="text"
                      value={limitAmountDisplay}
                      onChange={(e) => {
                        const formatted = formatInputNumber(e.target.value);
                        setLimitAmountDisplay(formatted);
                        const parsed = parseInputNumber(formatted);
                        form.setValue('limit_amount', parsed, { shouldValidate: true });
                      }}
                      placeholder=""
                      className="mt-1 text-sm placeholder:text-sm"
                    />
                    {form.formState.errors.limit_amount && (
                      <p className="text-sm text-brand-red mt-1">
                        {form.formState.errors.limit_amount.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="available_limit">
                      {t('debt.form.availableLimit', 'Available Limit (Rp)')}
                    </Label>
                    <Input
                      id="available_limit"
                      type="text"
                      value={availableLimitDisplay}
                      onChange={(e) => {
                        const formatted = formatInputNumber(e.target.value);
                        setAvailableLimitDisplay(formatted);
                        const parsed = parseInputNumber(formatted);
                        form.setValue('available_limit', parsed || undefined, { shouldValidate: true });
                      }}
                      placeholder=""
                      className="mt-1 text-sm placeholder:text-sm"
                    />
                    {form.formState.errors.available_limit && (
                      <p className="text-sm text-brand-red mt-1">
                        {form.formState.errors.available_limit.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {t('debt.form.availableLimitDesc', 'If filled, Used Amount will be calculated automatically')}
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="debt_amount">
                    {t('debt.form.actualDebt', 'Actual Debt (Rp)')} <span className="text-brand-red">*</span>
                  </Label>
                  <Input
                    id="debt_amount"
                    type="text"
                    value={debtAmountDisplay}
                    placeholder="0"
                    className="mt-1 text-sm placeholder:text-sm"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('debt.form.actualDebtDesc', 'Terpakai = Limit - Available Limit (read-only)')}
                  </p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="interest_rate">{t('debt.form.interestRate', 'Interest per Year (%)')}</Label>
                <Input
                  id="interest_rate"
                  type="text"
                  value={interestRateDisplay}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                    setInterestRateDisplay(value);
                    const parsed = parseFloat(value) || undefined;
                    form.setValue('interest_rate', parsed, { shouldValidate: true });
                  }}
                  placeholder="0"
                  className="mt-1 text-sm placeholder:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="minimum_payment">{t('debt.form.minimumPayment', 'Minimum Payment (Rp)')}</Label>
                <Input
                  id="minimum_payment"
                  type="text"
                  value={minimumPaymentDisplay}
                  onChange={(e) => {
                    const formatted = formatInputNumber(e.target.value);
                    setMinimumPaymentDisplay(formatted);
                    const parsed = parseInputNumber(formatted);
                    form.setValue('minimum_payment', parsed || undefined, { shouldValidate: true });
                  }}
                  placeholder="0"
                  className="mt-1 text-sm placeholder:text-sm"
                />
              </div>
            </div>

            {isOnlineLoan ? (
              // Fields for Pinjaman Online: Tanggal Mulai Pembayaran dan Tanggal Jatuh Tempo Akhir
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="due_date">{t('debt.form.paymentStartDate', 'Payment Start Date')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1 text-sm",
                          !selectedDueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDueDate ? format(selectedDueDate, "dd/MM/yyyy") : t('debt.form.selectDate', 'Select date')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDueDate}
                        onSelect={(date) => {
                          if (date) {
                            form.setValue('due_date', format(date, 'yyyy-MM-dd'));
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('debt.form.paymentStartDateDesc', 'First payment date (monthly)')}
                  </p>
                </div>

                <div>
                  <Label htmlFor="due_date_end">{t('debt.form.dueDateEnd', 'End Due Date')}</Label>
                  <Input
                    id="due_date_end"
                    type="text"
                    value={
                      selectedDueDate && loanDuration && loanDuration > 0
                        ? (() => {
                            const startDate = new Date(selectedDueDate);
                            const endDate = new Date(startDate);
                            // Tanggal jatuh tempo akhir = tanggal mulai + (lama pinjaman - 1) bulan
                            // Karena tanggal mulai sudah termasuk bulan pertama
                            endDate.setMonth(endDate.getMonth() + (loanDuration - 1));
                            return format(endDate, "dd/MM/yyyy");
                          })()
                        : "-"
                    }
                    readOnly
                    className="mt-1 bg-gray-50 text-sm placeholder:text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {loanDuration && loanDuration > 0
                      ? t('debt.form.dueDateEndDesc', `Automatically calculated: final payment month {duration}`, { duration: loanDuration.toString() })
                      : t('debt.form.dueDateEndDescEmpty', 'Fill start date and loan duration')}
                  </p>
                </div>
              </div>
            ) : (
              // Field for other debt types: Jatuh Tempo biasa
              <div>
                <Label htmlFor="due_date">{t('debt.form.dueDate', 'Due Date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1 text-sm",
                        !selectedDueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDueDate ? format(selectedDueDate, "dd/MM/yyyy") : t('debt.form.selectDate', 'Select date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDueDate}
                      onSelect={(date) => {
                        if (date) {
                          form.setValue('due_date', format(date, 'yyyy-MM-dd'));
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div>
              <Label htmlFor="status">{t('debt.form.status', 'Status')}</Label>
              {isMobile ? (
                <Drawer open={statusDrawerOpen} onOpenChange={setStatusDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "mt-1 w-full justify-between text-sm font-normal",
                        !form.watch('status') && "text-muted-foreground"
                      )}
                    >
                      <span className="truncate">
                        {form.watch('status') === 'active'
                          ? t('debt.status.active', 'Active')
                          : form.watch('status') === 'paid_off'
                            ? t('debt.status.paidOff', 'Paid Off')
                            : form.watch('status') === 'closed'
                              ? t('debt.status.closed', 'Closed')
                              : t('debt.form.selectStatus', 'Select status')}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent overlayClassName="z-[60]" className="z-[60] max-h-[85dvh] flex flex-col">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold">
                        {t('debt.form.status', 'Status')}
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { value: 'active' as const, label: t('debt.status.active', 'Active') },
                          { value: 'paid_off' as const, label: t('debt.status.paidOff', 'Paid Off') },
                          { value: 'closed' as const, label: t('debt.status.closed', 'Closed') },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              form.setValue('status', opt.value);
                              setStatusDrawerOpen(false);
                            }}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              form.watch('status') === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {form.watch('status') === opt.value ? <Check className="h-4 w-4 text-primary shrink-0" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-end gap-2">
                      <DrawerClose asChild>
                        <Button size="sm" className="min-w-[100px]">
                          {t('common.done', 'Done')}
                        </Button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Select
                  value={form.watch('status')}
                  onValueChange={(value: 'active' | 'paid_off' | 'closed') => 
                    form.setValue('status', value)
                  }
                >
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue placeholder={t('debt.form.selectStatus', 'Select status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('debt.status.active', 'Active')}</SelectItem>
                    <SelectItem value="paid_off">{t('debt.status.paidOff', 'Paid Off')}</SelectItem>
                    <SelectItem value="closed">{t('debt.status.closed', 'Closed')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label htmlFor="description">{t('debt.form.description', 'Description')}</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder={t('debt.form.descriptionPlaceholder', 'Additional notes about this debt...')}
                className="mt-1 min-h-[80px] resize-none text-sm placeholder:text-sm"
              />
            </div>
          </div>

          <DialogFooter className={cn(
            "flex-shrink-0 border-t",
            isMobile ? "px-4 pt-3 pb-3 bg-muted/30" : "flex justify-end space-x-3 p-4 bg-white"
          )}>
            <div className={cn("flex items-center gap-2", isMobile ? "justify-end" : "justify-end w-full")}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isLoading}
              >
                {t('debt.form.cancel', 'Cancel')}
              </Button>
              <Button
                type="submit"
                size="sm"
                className="min-w-[120px] flex items-center justify-center gap-1.5"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('debt.form.saving', 'Saving...')}</span>
                  </>
                ) : (
                  isEditMode ? t('debt.form.update', 'Update') : t('debt.form.save', 'Save')
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
