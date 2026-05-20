import React from 'react';
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
  t,
}: LivechatConversionFinancialSectionProps) {
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
