import React, { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { ConversionDraftLine } from '@/5-3-whatsapp/utils/livechatConversionValidation';
import {
  conversionLinesGrandTotal,
  formatConversionRp,
  parseDownPaymentAmount,
  type ConversionPaymentKindUi,
} from '@/5-3-whatsapp/utils/livechatConversionValidation';

export interface LivechatConversionFinancialSectionProps {
  lines: ConversionDraftLine[];
  paymentKind: ConversionPaymentKindUi;
  onPaymentKindChange: (kind: ConversionPaymentKindUi) => void;
  downPaymentRaw: string;
  onDownPaymentRawChange: (raw: string) => void;
  paymentDate: string;
  onPaymentDateChange: (isoDate: string) => void;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  onReceiptChange: (file: File | null) => void;
  disabled?: boolean;
  onFieldFocus?: (el: HTMLElement) => void;
  /** Selected category name (sub-service) — used for the total row label, e.g. "Total Jasa Foto Wedding". */
  categoryLabel?: string | null;
  omnichannelBankLabel?: string | null;
  /** Full formatted bank details for copy-to-clipboard (share with customer). */
  omnichannelBankCopyText?: string | null;
  omnichannelBankLoading?: boolean;
  omnichannelBankMissing?: boolean;
  t: (key: string, fallback?: string, variables?: Record<string, string | number>) => string;
}

export function LivechatConversionFinancialSection({
  lines,
  paymentKind,
  onPaymentKindChange,
  downPaymentRaw,
  onDownPaymentRawChange,
  paymentDate,
  onPaymentDateChange,
  paymentMethod,
  onPaymentMethodChange,
  onReceiptChange,
  disabled = false,
  onFieldFocus,
  categoryLabel,
  omnichannelBankLabel = null,
  omnichannelBankCopyText = null,
  omnichannelBankLoading = false,
  omnichannelBankMissing = false,
  t,
}: LivechatConversionFinancialSectionProps) {
  const [bankDetailsCopied, setBankDetailsCopied] = useState(false);
  const bankCopyPayload = (omnichannelBankCopyText ?? '').trim();
  const canCopyBankDetails =
    !omnichannelBankMissing && !omnichannelBankLoading && bankCopyPayload.length > 0;

  const handleCopyBankDetails = useCallback(async () => {
    if (!bankCopyPayload) {
      toast.info(
        t('whatsappInbox.conversionNoBankDetailsToCopy', 'No bank details available to copy.'),
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(bankCopyPayload);
      setBankDetailsCopied(true);
      toast.success(
        t('whatsappInbox.conversionBankDetailsCopied', 'Bank details copied to clipboard.'),
      );
      window.setTimeout(() => setBankDetailsCopied(false), 2000);
    } catch {
      toast.error(
        t('whatsappInbox.conversionBankDetailsCopyFailed', 'Could not copy bank details.'),
      );
    }
  }, [bankCopyPayload, t]);

  const total = conversionLinesGrandTotal(lines);
  const category = (categoryLabel ?? '').trim();
  const totalRowLabel = category
    ? t('whatsappInbox.conversionTotalForCategory', 'Total {{category}}', { category })
    : t('whatsappInbox.conversionTotalNoCategory', 'Total');
  const dp = parseDownPaymentAmount(downPaymentRaw);
  const remaining = paymentKind === 'dp' && dp != null ? Math.max(0, total - dp) : total;

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/35 p-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">
        {t('whatsappInbox.conversionFinancialTitle', 'Financial Information')}
      </p>

      <div className="space-y-1.5">
        <Label className="text-sm">
          {t('whatsappInbox.conversionOmnichannelBank', 'Destination bank account')}
        </Label>
        {omnichannelBankLoading ? (
          <p className="text-xs text-muted-foreground">
            {t('whatsappInbox.conversionOmnichannelBankLoading', 'Loading bank account…')}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <Input
              value={
                omnichannelBankMissing
                  ? t(
                      'whatsappInbox.conversionOmnichannelBankMissing',
                      'Not configured. Ask finance to enable Omnichannel on a bank account under Income → Transaction → Bank Accounts.',
                    )
                  : (omnichannelBankLabel ?? '')
              }
              readOnly
              className={cn(
                'min-w-0 flex-1 bg-muted text-sm',
                omnichannelBankMissing && 'border-amber-300 text-amber-900',
              )}
            />
            {canCopyBankDetails ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => void handleCopyBankDetails()}
                className="h-9 shrink-0 gap-1.5 border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-900 hover:bg-emerald-50"
                aria-label={t(
                  'whatsappInbox.conversionCopyBankDetails',
                  'Copy bank details',
                )}
              >
                {bankDetailsCopied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('whatsappInbox.conversionCopyBankDetails', 'Copy bank details')}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{totalRowLabel}</Label>
        <Input value={formatConversionRp(total)} readOnly className="bg-muted" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{t('whatsappInbox.conversionPaymentMode', 'Payment')}</Label>
        <RadioGroup
          value={paymentKind}
          onValueChange={(v) => onPaymentKindChange(v as ConversionPaymentKindUi)}
          disabled={disabled}
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="dp" id="conv-pay-dp" />
            <span>{t('whatsappInbox.conversionDownPayment', 'Down Payment')}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="full" id="conv-pay-full" />
            <span>{t('whatsappInbox.conversionMarkPaid', 'Mark as Paid')}</span>
          </label>
        </RadioGroup>
      </div>

      {paymentKind === 'dp' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="conv-dp-amount" className="text-sm">
              {t('whatsappInbox.conversionDownPaymentAmount', 'Down Payment Amount')}
            </Label>
            <Input
              id="conv-dp-amount"
              type="text"
              inputMode="decimal"
              value={downPaymentRaw}
              onChange={(e) => onDownPaymentRawChange(e.target.value)}
              onFocus={(e) => onFieldFocus?.(e.currentTarget)}
              disabled={disabled}
              placeholder={t('whatsappInbox.conversionDpPlaceholder', 'Masukkan nominal')}
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('whatsappInbox.conversionRemainingAmount', 'Remaining Amount')}</Label>
            <Input value={formatConversionRp(remaining)} readOnly className="bg-muted" />
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="conv-payment-date" className="text-sm">
          {t('whatsappInbox.conversionPaymentDate', 'Payment date')} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="conv-payment-date"
          type="date"
          value={paymentDate}
          onChange={(e) => onPaymentDateChange(e.target.value)}
          onFocus={(e) => onFieldFocus?.(e.currentTarget)}
          disabled={disabled}
          className="bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">
          {t('whatsappInbox.conversionPaymentMethod', 'Payment Method')} <span className="text-red-500">*</span>
        </Label>
        <Select value={paymentMethod || undefined} onValueChange={onPaymentMethodChange} disabled={disabled}>
          <SelectTrigger className="bg-white" onFocus={(e) => onFieldFocus?.(e.currentTarget)}>
            <SelectValue placeholder={t('whatsappInbox.conversionSelectPaymentMethod', 'Select payment method')} />
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

      <div className="space-y-2">
        <Label htmlFor="conv-receipt" className="text-sm">
          {t('whatsappInbox.conversionReceiptUpload', 'Receipt Upload')} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="conv-receipt"
          type="file"
          accept="image/*,.pdf"
          disabled={disabled}
          onFocus={(e) => onFieldFocus?.(e.currentTarget)}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onReceiptChange(f);
          }}
          className="cursor-pointer bg-white"
        />
      </div>
    </div>
  );
}
