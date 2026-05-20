import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import type { Service } from '@/6-1-product-knowledge/hooks/useServices';
import type { SubService } from '@/6-1-product-knowledge/hooks/useSubServices';
import { LivechatConversionLineServiceCategory } from '@/5-3-whatsapp/components/inbox/LivechatConversionLineServiceCategory';
import type { ConversionDraftLine } from '@/5-3-whatsapp/utils/livechatConversionValidation';
import {
  conversionLineTotal,
  createEmptyConversionDraftLine,
  formatConversionRp,
  isConversionDraftValid,
} from '@/5-3-whatsapp/utils/livechatConversionValidation';

export interface LivechatConversionDraftSectionProps {
  lines: ConversionDraftLine[];
  notes: string;
  servicesList: Service[];
  subServicesList: SubService[];
  onLinesChange: React.Dispatch<React.SetStateAction<ConversionDraftLine[]>>;
  onNotesChange: (next: string) => void;
  onMasterDataRefresh: () => void;
  fallbackServiceName?: string;
  fallbackCategoryName?: string;
  /** When omitted or `hidePrimaryAction`, the primary button is not rendered (e.g. modal uses footer submit). */
  onConfirm?: () => void;
  hidePrimaryAction?: boolean;
  disabled?: boolean;
  isSubmitting?: boolean;
  onFieldFocus?: (el: HTMLElement) => void;
  t: (key: string, fallback?: string, variables?: Record<string, string | number>) => string;
}

export function LivechatConversionDraftSection({
  lines,
  notes,
  servicesList,
  subServicesList,
  onLinesChange,
  onNotesChange,
  onMasterDataRefresh,
  fallbackServiceName = '',
  fallbackCategoryName = '',
  onConfirm,
  hidePrimaryAction = false,
  disabled = false,
  isSubmitting = false,
  onFieldFocus,
  t,
}: LivechatConversionDraftSectionProps) {
  const canSubmit =
    isConversionDraftValid(lines, notes.trim(), servicesList, subServicesList) &&
    !disabled &&
    !isSubmitting &&
    Boolean(onConfirm) &&
    !hidePrimaryAction;

  const updateLine = (
    id: string,
    patch: Partial<Pick<ConversionDraftLine, 'serviceName' | 'categoryName' | 'quantityRaw' | 'unitPriceRaw'>>,
  ) => {
    onLinesChange((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const addLine = () => {
    onLinesChange((prev) => [...prev, createEmptyConversionDraftLine()]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) return;
    onLinesChange((prev) => prev.filter((row) => row.id !== id));
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">
        {t('whatsappInbox.conversionItemsTitle', 'Konversi — detail penjualan')}
      </p>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={line.id}
            className="space-y-2 rounded-md border border-gray-200 bg-white/90 p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-600">
                {t('whatsappInbox.conversionLineLabel', 'Baris {{n}}', { n: index + 1 })}
              </span>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeLine(line.id)}
                  disabled={disabled || isSubmitting}
                  aria-label={t('whatsappInbox.conversionRemoveLine', 'Hapus baris')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <LivechatConversionLineServiceCategory
              serviceName={line.serviceName ?? ''}
              categoryName={line.categoryName ?? ''}
              servicesList={servicesList}
              subServicesList={subServicesList}
              onServiceChange={(v) => updateLine(line.id, { serviceName: v, categoryName: '' })}
              onCategoryChange={(v) => updateLine(line.id, { categoryName: v })}
              onMasterDataRefresh={onMasterDataRefresh}
              fallbackServiceName={fallbackServiceName}
              fallbackCategoryName={fallbackCategoryName}
              disabled={disabled || isSubmitting}
              onFieldFocus={onFieldFocus}
              t={t}
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  {t('whatsappInbox.conversionQuantity', 'Quantity')} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={line.quantityRaw}
                  onChange={(e) => updateLine(line.id, { quantityRaw: e.target.value })}
                  onFocus={(e) => onFieldFocus?.(e.currentTarget)}
                  disabled={disabled || isSubmitting}
                  className="h-9 bg-white text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  {t('whatsappInbox.conversionUnitPrice', 'Unit Price (Rp)')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={line.unitPriceRaw}
                  onChange={(e) => updateLine(line.id, { unitPriceRaw: e.target.value })}
                  onFocus={(e) => onFieldFocus?.(e.currentTarget)}
                  disabled={disabled || isSubmitting}
                  className="h-9 bg-white text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  {t('whatsappInbox.conversionTotalPrice', 'Total Price')}
                </label>
                <Input
                  readOnly
                  value={formatConversionRp(conversionLineTotal(line.quantityRaw, line.unitPriceRaw))}
                  className="h-9 bg-muted text-sm"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={addLine}
        disabled={disabled || isSubmitting}
      >
        <Plus className="mr-1 h-4 w-4" />
        {t('whatsappInbox.conversionAddLine', 'Tambah baris')}
      </Button>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">
          {t('whatsappInbox.conversionNotes', 'Notes')} <span className="text-red-500">*</span>
        </label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          onFocus={(e) => onFieldFocus?.(e.currentTarget)}
          placeholder={t('whatsappInbox.conversionNotesPlaceholder', 'Catatan konversi…')}
          disabled={disabled || isSubmitting}
          className="min-h-[72px] resize-none bg-white text-sm"
        />
      </div>

      {!hidePrimaryAction && onConfirm ? (
        <Button type="button" className="w-full" onClick={onConfirm} disabled={!canSubmit}>
          {isSubmitting
            ? t('whatsappInbox.conversionSubmitting', 'Menyimpan…')
            : t('whatsappInbox.conversionConfirm', 'Konfirmasi Converted')}
        </Button>
      ) : null}
    </div>
  );
}
