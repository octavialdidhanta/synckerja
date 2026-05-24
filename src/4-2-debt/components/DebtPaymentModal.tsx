import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { AlertCircle, CalendarIcon, Check, ChevronDown, Camera, FileText, Images, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/shared/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { CameraModal } from '@/mobile/shared/components/CameraModal';
import { pickReceiptImageFiles } from '@/mobile/shared/utils/pickReceiptFromGallery';
import { Debt } from '../types';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatInputNumber, parseInputNumber } from '../utils/numberFormat';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { toast } from 'sonner';
import { getPayableDebts } from '../utils/payableDebts';
import { effectiveOutstandingBalance } from '../utils/resolveDebtDisplay';
import type { ExpenseReceiptAutofillData } from '@/mobile/shared/services/analyzeExpenseReceiptWithAI';
import { isValidDebtPaymentBankAccountId, type DebtPaymentModalSubmitPayload } from '../services/submitDebtPayment';
import { IncomeAllocationOptionalSection } from '@/4-1-dashboard/components/IncomeAllocationOptionalSection';
import {
  MODAL_BRAND_HEADER_BAR,
  MODAL_BRAND_HEADER_CLOSE_BTN,
} from '@/shared/constants/modalBrandHeaderClasses';

const RECEIPT_ALLOWED = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const RECEIPT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

function hasAllowedReceiptType(file: File): boolean {
  const ty = (file.type ?? '').toLowerCase();
  if (ty && RECEIPT_ALLOWED.includes(ty)) return true;
  const fileName = (file.name ?? '').toLowerCase();
  return RECEIPT_ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function getReceiptValidationError(file: File): 'size' | 'type' | null {
  if (file.size > 10 * 1024 * 1024) return 'size';
  if (!hasAllowedReceiptType(file)) return 'type';
  return null;
}

function dataUrlToImageFile(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? 'image/jpeg';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}

interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paymentData: DebtPaymentModalSubmitPayload) => Promise<boolean>;
  debts: Debt[];
  isLoading?: boolean;
  shareFlowLocked?: boolean;
  initialReceiptFiles?: File[];
  initialReceiptFilesKey?: string;
  aiAutofillData?: ExpenseReceiptAutofillData;
  aiAutofillStatus?: 'idle' | 'loading' | 'success' | 'error';
  aiAutofillRequestId?: number;
}

export const DebtPaymentModal = ({
  isOpen,
  onClose,
  onSubmit,
  debts,
  isLoading = false,
  shareFlowLocked = false,
  initialReceiptFiles,
  initialReceiptFilesKey,
  aiAutofillData,
  aiAutofillStatus = 'idle',
  aiAutofillRequestId = 0,
}: DebtPaymentModalProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { bankAccounts, isLoading: bankAccountsLoading } = useBankAccounts();
  const { balances, refetch: refetchBalances } = useBankAccountBalances();
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');
  const [paymentAmountDisplay, setPaymentAmountDisplay] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [debtDrawerOpen, setDebtDrawerOpen] = useState(false);
  const [paymentMethodDrawerOpen, setPaymentMethodDrawerOpen] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [receiptCameraOpen, setReceiptCameraOpen] = useState(false);
  const [shareCancelConfirmOpen, setShareCancelConfirmOpen] = useState(false);
  const [transactionRefDisplay, setTransactionRefDisplay] = useState('');
  const [incomeAllocIncomeId, setIncomeAllocIncomeId] = useState('');
  const [incomeAllocAmountStr, setIncomeAllocAmountStr] = useState('');
  const receiptSectionRef = useRef<HTMLDivElement>(null);
  const isReceiptInteractionRef = useRef(false);
  const receiptProtectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedAiRequestRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);

  const payableDebts = useMemo(() => getPayableDebts(debts), [debts]);
  const selectedDebt = payableDebts.find((d) => d.id === selectedDebtId) || null;
  const paymentAmountNum = useMemo(() => parseInputNumber(paymentAmountDisplay), [paymentAmountDisplay]);

  const selectedAccountBalance = paymentMethod
    ? (balances.find((b) => b.bank_account_id === paymentMethod)?.balance ?? 0)
    : null;
  const insufficientBalance =
    paymentMethod != null &&
    paymentMethod !== '' &&
    selectedAccountBalance != null &&
    paymentAmountNum > 0 &&
    selectedAccountBalance < paymentAmountNum;

  const RECEIPT_PROTECTION_DELAY_MS = 2000;
  const clearReceiptProtectionAfterDelay = useCallback(() => {
    if (receiptProtectionTimeoutRef.current) clearTimeout(receiptProtectionTimeoutRef.current);
    receiptProtectionTimeoutRef.current = setTimeout(() => {
      receiptProtectionTimeoutRef.current = null;
      isReceiptInteractionRef.current = false;
    }, RECEIPT_PROTECTION_DELAY_MS);
  }, []);

  const addReceiptFilesSafe = useCallback(
    (incoming: File | File[]) => {
      const list = Array.isArray(incoming) ? incoming : [incoming];
      const next: File[] = [];
      for (const file of list) {
        const validationError = getReceiptValidationError(file);
        if (validationError === 'size') {
          toast.error(t('expenses.receiptTooLarge', 'File must be less than 10MB'));
          continue;
        }
        if (validationError === 'type') {
          toast.error(t('expenses.receiptInvalidType', 'Only JPG, PNG, WEBP, or PDF are allowed'));
          continue;
        }
        next.push(file);
      }
      if (next.length === 0) return;
      setReceiptFiles((prev) => [...prev, ...next]);
    },
    [t]
  );

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      lastAppliedAiRequestRef.current = null;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened) return;

    void refetchBalances();

    const first = payableDebts[0];
    setSelectedDebtId(first?.id ?? '');
    setPaymentAmountDisplay('');
    setPaymentDate(new Date());
    setPaymentMethod('');
    setNotes('');
    setTransactionRefDisplay('');
    setIncomeAllocIncomeId('');
    setIncomeAllocAmountStr('');
    if (shareFlowLocked && initialReceiptFiles?.length) {
      setReceiptFiles(initialReceiptFiles.filter((file) => getReceiptValidationError(file) === null));
    } else if (!shareFlowLocked) {
      setReceiptFiles([]);
    }
  }, [isOpen, shareFlowLocked, initialReceiptFilesKey, initialReceiptFiles, payableDebts, refetchBalances]);

  useEffect(() => {
    if (!isOpen || payableDebts.length === 0) return;
    if (selectedDebtId && payableDebts.some((d) => d.id === selectedDebtId)) return;
    setSelectedDebtId(payableDebts[0].id);
  }, [isOpen, payableDebts, selectedDebtId]);

  // Do not clear income allocation on every paymentMethod change: that races with
  // IncomeAllocationOptionalSection's auto-pick (parent useEffect runs after child and wiped selection).
  // Clearing on modal open (above) and invalid income for the new bank are handled inside the section.

  useEffect(() => {
    if (!shareFlowLocked || !isOpen || aiAutofillStatus === 'loading') return;
    if (lastAppliedAiRequestRef.current === aiAutofillRequestId) return;
    lastAppliedAiRequestRef.current = aiAutofillRequestId;
    const d = aiAutofillData;
    if (!d) return;
    if (d.amount && d.amount > 0) {
      const fmt = formatInputNumber(d.amount);
      setPaymentAmountDisplay(fmt);
    }
    if (d.createDate) {
      const parsed = new Date(d.createDate);
      if (!Number.isNaN(parsed.getTime())) setPaymentDate(parsed);
    }
    const refLines: string[] = [];
    if (d.referenceNumber) {
      refLines.push(`${t('shareReceipt.aiRefLinePrefix', 'Ref')}: ${d.referenceNumber}`);
    }
    if (d.paymentCode) {
      refLines.push(`${t('shareReceipt.aiPaymentCodeLinePrefix', 'Payment code')}: ${d.paymentCode}`);
    }
    const extra = refLines.join('\n');
    const baseNote = d.description?.trim() ?? '';
    const mergedNotes = extra ? (baseNote ? `${baseNote}\n${extra}` : extra) : baseNote;
    if (mergedNotes) setNotes(mergedNotes);
    if (d.transactionId) setTransactionRefDisplay(d.transactionId);
  }, [shareFlowLocked, isOpen, aiAutofillStatus, aiAutofillRequestId, aiAutofillData, t]);

  const receiptPreviewUrls = useMemo(
    () => receiptFiles.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [receiptFiles]
  );

  useEffect(() => {
    return () => {
      receiptPreviewUrls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [receiptPreviewUrls]);

  const handleTakeReceiptPhoto = () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      isReceiptInteractionRef.current = true;
      setReceiptCameraOpen(true);
      return;
    }
    toast.message(t('expenses.receiptUseFilePicker', 'Pilih gambar dari berkas'), {
      description: t(
        'expenses.receiptUseFilePickerHint',
        'Kamera langsung tidak tersedia di perangkat ini. Gunakan “Pilih file”.'
      ),
    });
    void handlePickReceiptFromGallery();
  };

  const handleReceiptCameraCapture = (imageData: string) => {
    try {
      const file = dataUrlToImageFile(imageData, `receipt_${Date.now()}.jpg`);
      addReceiptFilesSafe(file);
      toast.success(t('expenses.receiptPhotoTaken', 'Receipt photo taken'));
      clearReceiptProtectionAfterDelay();
      requestAnimationFrame(() => {
        receiptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch {
      toast.error(t('expenses.photoCaptureFailed', 'Photo capture failed'));
    }
  };

  const handleReceiptCameraClose = () => {
    setReceiptCameraOpen(false);
    clearReceiptProtectionAfterDelay();
  };

  const handlePickReceiptFromGallery = async () => {
    try {
      const files = await pickReceiptImageFiles({ maxItems: 20, mediaType: 'imageOnly' });
      if (!files.length) return;
      for (const file of files) {
        addReceiptFilesSafe(file);
      }
      requestAnimationFrame(() => {
        receiptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch {
      toast.error(t('expenses.receiptPickFailed', 'Failed to pick receipt file'));
    }
  };

  const handleRequestClose = () => {
    if (shareFlowLocked) {
      setShareCancelConfirmOpen(true);
      return;
    }
    if (receiptProtectionTimeoutRef.current) {
      clearTimeout(receiptProtectionTimeoutRef.current);
      receiptProtectionTimeoutRef.current = null;
    }
    isReceiptInteractionRef.current = false;
    onClose();
  };

  const confirmShareCancel = () => {
    setShareCancelConfirmOpen(false);
    if (receiptProtectionTimeoutRef.current) {
      clearTimeout(receiptProtectionTimeoutRef.current);
      receiptProtectionTimeoutRef.current = null;
    }
    isReceiptInteractionRef.current = false;
    setReceiptFiles([]);
    onClose();
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && shareFlowLocked) {
      setShareCancelConfirmOpen(true);
      return;
    }
    if (!open) {
      if (receiptProtectionTimeoutRef.current) {
        clearTimeout(receiptProtectionTimeoutRef.current);
        receiptProtectionTimeoutRef.current = null;
      }
      isReceiptInteractionRef.current = false;
      onClose();
    }
  };

  const remainingDebt = selectedDebt ? effectiveOutstandingBalance(selectedDebt) : 0;

  const handleSubmit = async () => {
    if (!selectedDebt || !paymentAmountNum || paymentAmountNum <= 0) {
      return;
    }

    if (shareFlowLocked) {
      if (aiAutofillStatus === 'loading') return;
      if (!transactionRefDisplay.trim()) {
        toast.error(
          t('debt.payment.transactionIdRequired', 'Transaction ID was not detected on the receipt. Try again or use another destination.')
        );
        return;
      }
      if (receiptFiles.length === 0) {
        toast.error(t('debt.payment.receiptRequired', 'Add at least one receipt file.'));
        return;
      }
    }

    if (!isValidDebtPaymentBankAccountId(paymentMethod)) {
      toast.error(t('debt.payment.bankAccountRequired', 'Pilih rekening sumber dana untuk melanjutkan pembayaran.'));
      return;
    }

    if (insufficientBalance) {
      toast.error(t('debt.payment.insufficientBalance', 'Saldo rekening tidak mencukupi untuk pembayaran ini.'));
      return;
    }

    const rem = selectedDebt ? effectiveOutstandingBalance(selectedDebt) : 0;
    if (rem === 0) {
      const confirmed = window.confirm(
        t(
          'debt.payment.confirmInterestOnly',
          'The principal debt is already paid off (Rp 0). This payment will be recorded as interest payment only. Continue?'
        )
      );
      if (!confirmed) return;
    }

    let incomeAllocation: DebtPaymentModalSubmitPayload['incomeAllocation'];
    if (incomeAllocIncomeId.trim()) {
      const raw = incomeAllocAmountStr.trim().replace(/\s/g, '').replace(/,/g, '.');
      const amt = parseFloat(raw);
      if (Number.isFinite(amt) && amt > 0) {
        incomeAllocation = { income_transaction_id: incomeAllocIncomeId.trim(), amount: amt };
      }
    }

    const paymentData: DebtPaymentModalSubmitPayload = {
      debtId: selectedDebt.id,
      paymentAmount: paymentAmountNum,
      paymentDate: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      paymentMethod: paymentMethod.trim(),
      notes: notes || undefined,
      transactionReference: shareFlowLocked && transactionRefDisplay.trim() ? transactionRefDisplay : undefined,
      receiptFile: shareFlowLocked ? receiptFiles[0] : undefined,
      incomeAllocation,
    };

    const success = await onSubmit(paymentData);
    if (success) {
      onClose();
    }
  };

  const formatBankAccountDisplay = (account: { id: string; name: string; account_number: string | null }) => {
    const balance = balances.find((b) => b.bank_account_id === account.id);
    const balanceAmount = balance?.balance ?? 0;
    const balanceText = formatToRupiah(balanceAmount);
    if (account.account_number) {
      return `${account.name} - ${account.account_number} (Balance: ${balanceText})`;
    }
    return `${account.name} (Balance: ${balanceText})`;
  };

  const shareSubmitBlocked =
    shareFlowLocked &&
    (aiAutofillStatus === 'loading' ||
      !transactionRefDisplay.trim() ||
      receiptFiles.length === 0);

  const showAiIdentifierReviewHint = useMemo(
    () =>
      Boolean(
        shareFlowLocked &&
          aiAutofillStatus === 'success' &&
          aiAutofillData &&
          (aiAutofillData.transactionIdNeedsReview === true ||
            aiAutofillData.referenceNumberNeedsReview === true ||
            aiAutofillData.paymentCodeNeedsReview === true),
      ),
    [shareFlowLocked, aiAutofillStatus, aiAutofillData],
  );

  const submitDisabled =
    isLoading ||
    !selectedDebt ||
    !paymentAmountNum ||
    paymentAmountNum <= 0 ||
    !isValidDebtPaymentBankAccountId(paymentMethod) ||
    insufficientBalance ||
    shareSubmitBlocked;

  if (payableDebts.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className={cn(
            isMobile
              ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden'
              : 'w-[95vw] sm:w-[500px] max-w-[500px]'
          )}
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          {isMobile ? (
            <DialogHeader
              className={cn(
                'safe-area-top flex flex-shrink-0 flex-row flex-nowrap items-stretch gap-0 space-y-0 px-0 py-0 text-left',
                MODAL_BRAND_HEADER_BAR,
              )}
            >
              <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="m-0 flex min-h-0 min-w-0 items-center text-left text-base font-semibold leading-tight text-primary-foreground">
                    {t('debt.payment.title', 'Pay Debt')}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-left text-xs leading-snug text-primary-foreground/90">
                    {t('debt.payment.noPayableDebts', 'No debts available for payment')}
                  </DialogDescription>
                </div>
                <DialogClose type="button" className={MODAL_BRAND_HEADER_CLOSE_BTN}>
                  <X className="block h-4 w-4 shrink-0" aria-hidden />
                  <span className="sr-only">{t('common.close', 'Close')}</span>
                </DialogClose>
              </div>
            </DialogHeader>
          ) : (
            <DialogHeader className={cn(MODAL_BRAND_HEADER_BAR, 'p-4 pb-3')}>
              <DialogTitle className="text-lg font-semibold text-primary-foreground">
                {t('debt.payment.title', 'Pay Debt')}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/90">
                {t('debt.payment.noPayableDebts', 'No debts available for payment')}
              </DialogDescription>
            </DialogHeader>
          )}
          <DialogFooter className={cn('flex-shrink-0 border-t', isMobile ? 'px-4 pt-3 pb-3 bg-muted/30' : '')}>
            <div className="flex items-center justify-end gap-2 w-full">
              <Button type="button" variant="outline" size="sm" onClick={handleRequestClose}>
                {t('debt.form.cancel', 'Cancel')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Fragment>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className={cn(
            isMobile
              ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden'
              : 'w-[95vw] sm:w-[500px] sm:h-[500px] max-w-[500px] max-h-[500px] p-0 overflow-hidden flex flex-col min-w-0'
          )}
          fullscreenAnimation={isMobile}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-select-content]') || target.closest('[data-radix-select-trigger]')) {
              e.preventDefault();
              return;
            }
            if (shareFlowLocked || isReceiptInteractionRef.current) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-select-content]') || target.closest('[data-radix-select-trigger]')) {
              e.preventDefault();
              return;
            }
            if (shareFlowLocked || isReceiptInteractionRef.current) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (shareFlowLocked || isReceiptInteractionRef.current) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (shareFlowLocked) e.preventDefault();
          }}
          hideCloseButton={isMobile}
        >
          {isMobile ? (
            <DialogHeader
              className={cn(
                'safe-area-top flex flex-shrink-0 flex-row flex-nowrap items-stretch gap-0 space-y-0 px-0 py-0 text-left',
                MODAL_BRAND_HEADER_BAR,
              )}
            >
              <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="m-0 flex min-h-0 min-w-0 items-center text-left text-base font-semibold leading-tight text-primary-foreground">
                    {t('debt.payment.title', 'Pay Debt')}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-left text-xs leading-snug text-primary-foreground/90">
                    {shareFlowLocked
                      ? t('debt.payment.shareDescription', 'Record a debt payment using your shared receipt.')
                      : t('debt.payment.description', 'Record a payment for this debt')}
                  </DialogDescription>
                </div>
                <button
                  type="button"
                  className={MODAL_BRAND_HEADER_CLOSE_BTN}
                  onClick={() => handleRequestClose()}
                  disabled={isLoading}
                  aria-label={t('common.close', 'Close')}
                >
                  <X className="block h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
            </DialogHeader>
          ) : (
            <DialogHeader className={cn('flex-shrink-0', MODAL_BRAND_HEADER_BAR, 'p-4 pb-3')}>
              <DialogTitle className="text-lg font-semibold text-primary-foreground">
                {t('debt.payment.title', 'Pay Debt')}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/90">
                {shareFlowLocked
                  ? t('debt.payment.shareDescription', 'Record a debt payment using your shared receipt.')
                  : t('debt.payment.description', 'Record a payment for this debt')}
              </DialogDescription>
            </DialogHeader>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll px-4 py-4 space-y-4 [-ms-overflow-style:none] [scrollbar-width:none] scrollbar-hide [&::-webkit-scrollbar]:hidden">
            {shareFlowLocked && aiAutofillStatus === 'loading' ? (
              <div className="rounded-md border border-brand-blue/30 bg-brand-blue/10 dark:bg-brand-blue/15 px-3 py-2 text-xs text-brand-blue dark:text-brand-blue/90 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{t('expenses.aiAnalyzingReceipt', 'Menganalisis receipt dengan AI...')}</span>
              </div>
            ) : null}

            <div>
              <Label htmlFor="debt_select">
                {t('debt.payment.selectDebt', 'Select Debt')} <span className="text-brand-red">*</span>
              </Label>
              {isMobile ? (
                <Drawer open={debtDrawerOpen} onOpenChange={setDebtDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'mt-1 w-full justify-between text-sm font-normal',
                        !selectedDebtId && 'text-muted-foreground'
                      )}
                    >
                      <span className="truncate text-left">
                        {selectedDebt
                          ? `${selectedDebt.debt_name} - ${t('debt.payment.remainingDebt', 'Remaining Debt')}: ${formatToRupiah(remainingDebt)}`
                          : t('debt.payment.selectDebtPlaceholder', 'Select a debt to pay')}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent overlayClassName="z-[60]" className="z-[60] max-h-[85dvh] flex flex-col">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold">
                        {t('debt.payment.selectDebt', 'Select Debt')}
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {payableDebts.map((debt) => {
                          const remaining = effectiveOutstandingBalance(debt);
                          const label = `${debt.debt_name} - ${t('debt.payment.remainingDebt', 'Remaining Debt')}: ${formatToRupiah(remaining)}`;
                          return (
                            <button
                              key={debt.id}
                              type="button"
                              onClick={() => {
                                setSelectedDebtId(debt.id);
                                setDebtDrawerOpen(false);
                              }}
                              className={cn(
                                'flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0',
                                selectedDebtId === debt.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'
                              )}
                            >
                              <span className="truncate">{label}</span>
                              {selectedDebtId === debt.id ? <Check className="h-4 w-4 text-primary shrink-0" /> : null}
                            </button>
                          );
                        })}
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
                <Select value={selectedDebtId} onValueChange={setSelectedDebtId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('debt.payment.selectDebtPlaceholder', 'Select a debt to pay')} />
                  </SelectTrigger>
                  <SelectContent>
                    {payableDebts.map((debt) => {
                      const remaining = effectiveOutstandingBalance(debt);
                      return (
                        <SelectItem key={debt.id} value={debt.id}>
                          {debt.debt_name} - {t('debt.payment.remainingDebt', 'Remaining Debt')}: {formatToRupiah(remaining)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedDebt && (
              <div className="bg-gray-50 dark:bg-muted/40 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-muted-foreground">{t('debt.payment.debtName', 'Debt Name')}:</span>
                  <span className="text-sm font-semibold">{selectedDebt.debt_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-muted-foreground">{t('debt.payment.totalDebt', 'Total Debt')}:</span>
                  <span className="text-sm font-semibold text-brand-red">{formatToRupiah(remainingDebt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-muted-foreground">{t('debt.payment.remainingDebt', 'Remaining Debt')}:</span>
                  <span className="text-sm font-semibold text-brand-red">{formatToRupiah(remainingDebt)}</span>
                </div>
              </div>
            )}

            {shareFlowLocked ? (
              <div>
                <Label htmlFor="transaction_ref_display">{t('debt.payment.transactionIdLabel', 'Transaction ID')}</Label>
                <Input
                  id="transaction_ref_display"
                  value={transactionRefDisplay}
                  readOnly
                  disabled
                  className="mt-1 text-sm bg-muted"
                  placeholder={t('debt.payment.transactionIdPlaceholder', 'Detected from receipt by AI')}
                />
                {!transactionRefDisplay.trim() && aiAutofillStatus !== 'loading' ? (
                  <p className="text-xs text-brand-red dark:text-brand-red/90 mt-1">
                    {t(
                      'debt.payment.transactionIdMissingHint',
                      'No reference found yet. Wait for analysis or choose another destination.'
                    )}
                  </p>
                ) : null}
                {showAiIdentifierReviewHint ? (
                  <Alert className="mt-2 border-brand-red/30 bg-brand-red/10 text-brand-red dark:border-brand-red/40 dark:bg-brand-red/15 dark:text-brand-red/90">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {t(
                        'shareReceipt.aiIdentifierReviewHint',
                        'AI flagged reference numbers or codes on the receipt for manual verification against the original image (e.g. truncated or uncertain ID).',
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {selectedDebt && (
              <div>
                <Label htmlFor="payment_amount">
                  {t('debt.payment.amount', 'Payment Amount (Rp)')} <span className="text-brand-red">*</span>
                </Label>
                <Input
                  id="payment_amount"
                  type="text"
                  value={paymentAmountDisplay}
                  onChange={(e) => {
                    const formatted = formatInputNumber(e.target.value);
                    setPaymentAmountDisplay(formatted);
                  }}
                  placeholder=""
                  className="mt-1"
                  disabled={!selectedDebt}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('debt.payment.remainingDebt', 'Remaining Debt')}: {formatToRupiah(remainingDebt)}.{' '}
                  {t('debt.payment.interestHint', 'You can enter a higher amount if payment includes interest.')}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="payment_date">
                {t('debt.payment.date', 'Payment Date')} <span className="text-brand-red">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal mt-1',
                      !paymentDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, 'dd/MM/yyyy') : t('debt.form.selectDate', 'Select date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="payment_method">
                {t('debt.payment.method', 'Payment Method')} <span className="text-brand-red">*</span>
              </Label>
              {isMobile ? (
                <Drawer
                  open={paymentMethodDrawerOpen}
                  onOpenChange={(open) => {
                    setPaymentMethodDrawerOpen(open);
                    if (open) void refetchBalances();
                  }}
                >
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'mt-1 w-full justify-between text-sm font-normal',
                        !paymentMethod && 'text-muted-foreground'
                      )}
                    >
                      <span className="truncate text-left">
                        {paymentMethod && bankAccounts.length > 0
                          ? (() => {
                              const selectedAccount = bankAccounts.find((acc) => acc.id === paymentMethod);
                              return selectedAccount ? formatBankAccountDisplay(selectedAccount) : '';
                            })()
                          : t('debt.payment.selectMethod', 'Select payment method')}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent overlayClassName="z-[60]" className="z-[60] max-h-[85dvh] flex flex-col">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold">{t('debt.payment.method', 'Payment Method')}</DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {bankAccountsLoading ? (
                          <div className="px-3 py-2.5 text-sm text-muted-foreground">Loading...</div>
                        ) : bankAccounts && bankAccounts.length > 0 ? (
                          bankAccounts.map((account) => {
                            const label = formatBankAccountDisplay(account);
                            return (
                              <button
                                key={account.id}
                                type="button"
                                onClick={() => {
                                  setPaymentMethod(account.id);
                                  setPaymentMethodDrawerOpen(false);
                                }}
                                className={cn(
                                  'flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0',
                                  paymentMethod === account.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'
                                )}
                              >
                                <span className="truncate">{label}</span>
                                {paymentMethod === account.id ? <Check className="h-4 w-4 text-primary shrink-0" /> : null}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2.5 text-sm text-muted-foreground">
                            {t('debt.payment.noBankAccounts', 'No bank accounts available')}
                          </div>
                        )}
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
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  onOpenChange={(open) => {
                    if (open) void refetchBalances();
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('debt.payment.selectMethod', 'Select payment method')}>
                      {paymentMethod && bankAccounts.length > 0
                        ? (() => {
                            const selectedAccount = bankAccounts.find((acc) => acc.id === paymentMethod);
                            return selectedAccount ? formatBankAccountDisplay(selectedAccount) : '';
                          })()
                        : ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccountsLoading ? (
                      <SelectItem value="_loading" disabled>
                        Loading...
                      </SelectItem>
                    ) : bankAccounts && bankAccounts.length > 0 ? (
                      bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {formatBankAccountDisplay(account)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_none" disabled>
                        {t('debt.payment.noBankAccounts', 'No bank accounts available')}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              {insufficientBalance && (
                <p className="text-xs text-brand-red mt-1">
                  {t('debt.payment.insufficientBalance', 'Saldo rekening tidak mencukupi untuk pembayaran ini.')}{' '}
                  ({t('debt.payment.balance', 'Balance')}: {formatToRupiah(selectedAccountBalance ?? 0)})
                </p>
              )}
            </div>

            <IncomeAllocationOptionalSection
              bankAccountId={isValidDebtPaymentBankAccountId(paymentMethod) ? paymentMethod.trim() : undefined}
              referenceAmount={paymentAmountNum}
              referenceDate={paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
              selectedIncomeId={incomeAllocIncomeId}
              onSelectedIncomeId={setIncomeAllocIncomeId}
              allocationAmountStr={incomeAllocAmountStr}
              onAllocationAmountStrChange={setIncomeAllocAmountStr}
            />

            <div>
              <Label htmlFor="notes">{t('debt.payment.notes', 'Notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('debt.payment.notesPlaceholder', 'Additional notes about this payment...')}
                className="mt-1 min-h-[80px] resize-none text-sm"
              />
            </div>

            {shareFlowLocked ? (
              <div ref={receiptSectionRef} className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
                <Label>{t('debt.payment.receiptSection', 'Payment receipt')}</Label>
                <p className="text-xs text-muted-foreground/80 mb-2">
                  {t('debt.payment.receiptImageFormats', 'JPG / PNG / WEBP, max 10MB per file')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleTakeReceiptPhoto}>
                      <Camera className="h-4 w-4" />
                      {t('debt.payment.receiptPhotoButton', 'Payment receipt photo')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handlePickReceiptFromGallery()}
                  >
                    <Images className="h-4 w-4" />
                    {t('debt.payment.receiptFromGallery', 'Gallery')}
                  </Button>
                </div>
                {receiptFiles.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {receiptFiles.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="relative aspect-square rounded-md border bg-background overflow-hidden flex items-center justify-center"
                      >
                        {f.type.startsWith('image/') && receiptPreviewUrls[i] ? (
                          <img src={receiptPreviewUrls[i]!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        )}
                        <button
                          type="button"
                          className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 border"
                          aria-label={t('common.remove', 'Remove')}
                          onClick={() => setReceiptFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <span className="text-xs px-1">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('debt.payment.receiptHint', 'Attach at least one proof of payment.')}</p>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter
            className={cn(
              'flex-shrink-0 border-t',
              isMobile ? 'px-4 pt-3 pb-3 bg-muted/30' : 'flex justify-end space-x-3 p-4 bg-white'
            )}
          >
            <div className={cn('flex items-center gap-2', isMobile ? 'justify-end' : 'justify-end w-full')}>
              <Button type="button" variant="outline" size="sm" onClick={handleRequestClose} disabled={isLoading}>
                {t('debt.form.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-w-[120px] flex items-center justify-center gap-1.5"
                onClick={() => void handleSubmit()}
                disabled={submitDisabled}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('debt.form.saving', 'Saving...')}</span>
                  </>
                ) : (
                  t('debt.payment.submit', 'Record Payment')
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={shareCancelConfirmOpen} onOpenChange={setShareCancelConfirmOpen}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('shareReceipt.leaveTitle', 'Batalkan berbagi?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('debt.payment.shareCancelDescription', 'Close without recording this payment? Your draft will be lost.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Batal')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmShareCancel}>{t('shareReceipt.leaveConfirm', 'Keluar')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isMobile ? (
        <CameraModal
          isOpen={receiptCameraOpen}
          title={t('debt.payment.receiptCameraTitle', 'Payment receipt')}
          onClose={handleReceiptCameraClose}
          onCapture={handleReceiptCameraCapture}
          facingMode="environment"
          overlayClassName="z-[80]"
          contentClassName="z-[80]"
        />
      ) : null}
    </Fragment>
  );
};
