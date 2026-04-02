import { useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { formatToRupiah } from '@/utils/formatCurrency';
import { formatInputNumber, parseInputNumber } from '@/shared/lib/pricingInputUtils';
import { toast } from 'sonner';
import type { BankAccount } from '@/shared/hooks/finance/useBankAccounts';
import { useCreateBankTransfer } from '@/shared/hooks/finance/useCreateBankTransfer';
import { AlertCircle, FileText, Upload, X } from 'lucide-react';

export interface BankTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAccount: BankAccount | null;
  destinationAccounts: BankAccount[];
  sourceBalance: number;
}

type Step = 1 | 2 | 3;

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const RECEIPT_ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const RECEIPT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

function hasAllowedReceiptType(file: File): boolean {
  const type = (file.type ?? '').toLowerCase();
  if (type && RECEIPT_ALLOWED.includes(type)) return true;
  const fileName = file.name.toLowerCase();
  return RECEIPT_ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function getReceiptValidationError(file: File): 'size' | 'type' | null {
  if (file.size > MAX_RECEIPT_SIZE) return 'size';
  if (!hasAllowedReceiptType(file)) return 'type';
  return null;
}

export function BankTransferDialog({
  open,
  onOpenChange,
  sourceAccount,
  destinationAccounts,
  sourceBalance,
}: BankTransferDialogProps) {
  const { t } = useAppTranslation();
  const { mutateAsync, isPending } = useCreateBankTransfer();
  const confirmLockRef = useRef(false);

  const [step, setStep] = useState<Step>(1);
  const [toId, setToId] = useState<string>('');
  const [amountStr, setAmountStr] = useState('');
  const [feeStr, setFeeStr] = useState('');
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      confirmLockRef.current = false;
      setStep(1);
      setToId('');
      setAmountStr('');
      setFeeStr('');
      setNote('');
      setReceiptFile(null);
    }
  }, [open]);

  const amountNum = useMemo(() => parseInputNumber(amountStr || '0'), [amountStr]);
  const feeNum = useMemo(() => parseInputNumber(feeStr || '0'), [feeStr]);
  const totalOut = amountNum + feeNum;

  const dest = destinationAccounts.find((a) => a.id === toId);
  const receiptPreviewUrl = useMemo(
    () => (receiptFile && receiptFile.type.startsWith('image/') ? URL.createObjectURL(receiptFile) : null),
    [receiptFile]
  );

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  const validationError = useMemo(() => {
    if (step === 1 && !toId) {
      return t('incomes.bankTransfer.validation.destination', 'Select a destination account.');
    }
    if (step === 2) {
      if (!(amountNum > 0)) {
        return t('incomes.bankTransfer.validation.amount', 'Enter an amount greater than zero.');
      }
      if (feeNum < 0) {
        return t('incomes.bankTransfer.validation.fee', 'Fee cannot be negative.');
      }
      if (totalOut > sourceBalance + 1e-6) {
        return t(
          'incomes.bankTransfer.validation.insufficient',
          'Balance is not enough for this amount and fee.'
        );
      }
    }
    return null;
  }, [step, toId, amountNum, feeNum, totalOut, sourceBalance, t]);

  const handleNext = () => {
    if (validationError) return;
    if (step < 3) setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const handleConfirm = async () => {
    if (confirmLockRef.current || isPending) return;
    if (!sourceAccount || !toId || !(amountNum > 0) || feeNum < 0 || totalOut > sourceBalance + 1e-6) {
      return;
    }
    confirmLockRef.current = true;
    try {
      await mutateAsync({
        fromBankAccountId: sourceAccount.id,
        toBankAccountId: toId,
        amount: amountNum,
        fee: feeNum,
        note: note.trim() || null,
        receiptFile,
      });
      onOpenChange(false);
    } catch {
      /* toast in hook */
    } finally {
      confirmLockRef.current = false;
    }
  };

  const stepTitle =
    step === 1
      ? t('incomes.bankTransfer.stepDestination', 'Destination account')
      : step === 2
        ? t('incomes.bankTransfer.stepAmount', 'Amount & fee')
        : t('incomes.bankTransfer.stepConfirm', 'Confirm');

  const applyReceiptFile = (file: File) => {
    const err = getReceiptValidationError(file);
    if (err === 'size') {
      toast.error(t('incomes.bankTransfer.receiptTooLarge', 'File must be less than 10MB'));
      return;
    }
    if (err === 'type') {
      toast.error(t('incomes.bankTransfer.receiptInvalidType', 'Only JPG, PNG, WEBP, or PDF are allowed'));
      return;
    }
    setReceiptFile(file);
  };

  const handleDesktopFileChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyReceiptFile(file);
    e.currentTarget.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] max-w-[640px] flex-col gap-0 p-0 sm:max-w-[640px]'
        )}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-primary/10 to-primary/5 px-4 pb-3 pt-4 text-left'
          )}
        >
          <DialogTitle className="text-lg font-semibold">
            {t('incomes.bankTransfer.title', 'Transfer between accounts')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{stepTitle}</DialogDescription>
        </DialogHeader>

        <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4">
          {sourceAccount ? (
            <p className="mb-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t('incomes.bankTransfer.from', 'From')}:</span>{' '}
              {sourceAccount.name}
              {sourceAccount.account_number ? ` · ${sourceAccount.account_number}` : ''}
              <span className="mt-1 block">
                {t('incomes.bankAccount', 'Bank account')}:{' '}
                <span className="font-medium tabular-nums">{formatToRupiah(sourceBalance)}</span>
              </span>
            </p>
          ) : null}

          {step === 1 && (
            <div className="space-y-2">
              <Label>{t('incomes.bankTransfer.to', 'To')}</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t('incomes.bankTransfer.selectDestination', 'Select destination account')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.account_number ? ` · ${a.account_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bt-amount">
                  {t('incomes.bankTransfer.amountLabel', 'Amount credited to destination (IDR)')}
                </Label>
                <Input
                  id="bt-amount"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = parseInputNumber(raw);
                    setAmountStr(
                      Number.isFinite(n) && n >= 0 ? formatInputNumber(String(Math.floor(n))) : raw
                    );
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bt-fee">
                  {t('incomes.bankTransfer.feeLabel', 'Admin / transfer fee (IDR)')}
                </Label>
                <Input
                  id="bt-fee"
                  inputMode="numeric"
                  value={feeStr}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = parseInputNumber(raw);
                    setFeeStr(
                      Number.isFinite(n) && n >= 0 ? formatInputNumber(String(Math.floor(n))) : raw
                    );
                  }}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    'incomes.bankTransfer.feeHint',
                    'The fee only reduces the source balance; it is not credited to the destination.'
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bt-note">{t('incomes.bankTransfer.noteOptional', 'Note (optional)')}</Label>
                <Textarea
                  id="bt-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('incomes.bankTransfer.receipt', 'Receipt (optional)')}</Label>
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-3">
                  {receiptFile ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {receiptFile.type.startsWith('image/') && receiptPreviewUrl ? (
                          <img
                            src={receiptPreviewUrl}
                            alt=""
                            className="h-10 w-10 rounded border object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded border bg-background">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate text-xs text-muted-foreground">{receiptFile.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setReceiptFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                      <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-500" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        {t('incomes.bankTransfer.receiptHint', 'Attach transfer proof (optional).')}
                      </p>
                    </div>
                  )}

                  <p className="mb-2 text-xs text-muted-foreground">
                    {t('incomes.bankTransfer.receiptFormats', 'JPG / PNG / WEBP / PDF, max 10MB')}
                  </p>
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleDesktopFileChange}
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="mr-1.5 h-4 w-4" />
                        {t('incomes.bankTransfer.chooseFile', 'Choose file')}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 3 && dest && sourceAccount && (
            <div className="space-y-3 text-sm">
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('incomes.bankTransfer.to', 'To')}</span>
                  <span className="text-right font-medium">{dest.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t('incomes.bankTransfer.creditedToDestination', 'Credited to destination')}
                  </span>
                  <span className="font-semibold tabular-nums">{formatToRupiah(amountNum)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t('incomes.bankTransfer.feeLabel', 'Admin / transfer fee (IDR)')}
                  </span>
                  <span className="tabular-nums">{formatToRupiah(feeNum)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-2 border-t pt-2">
                  <span className="text-muted-foreground">
                    {t('incomes.bankTransfer.totalDebit', 'Total debited from source')}
                  </span>
                  <span className="font-semibold tabular-nums">{formatToRupiah(totalOut)}</span>
                </div>
              </div>
            </div>
          )}

          {validationError && (step === 1 || step === 2) ? (
            <p className="mt-3 text-sm text-destructive">{validationError}</p>
          ) : null}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 border-t bg-muted/30 px-4 pb-3 pt-3 sm:justify-between">
          <div className="flex w-full items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isPending || step === 1} onClick={handleBack}>
              {t('incomes.bankTransfer.back', 'Back')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => onOpenChange(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              {step < 3 ? (
                <Button type="button" size="sm" disabled={!!validationError || isPending} onClick={handleNext}>
                  {t('incomes.bankTransfer.next', 'Next')}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[120px]"
                  disabled={isPending || totalOut > sourceBalance + 1e-6}
                  onClick={handleConfirm}
                >
                  {isPending
                    ? t('incomes.bankTransfer.submitting', 'Processing…')
                    : t('incomes.bankTransfer.confirm', 'Confirm transfer')}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
