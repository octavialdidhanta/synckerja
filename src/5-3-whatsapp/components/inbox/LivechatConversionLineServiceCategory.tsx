import { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { LivechatConversionMasterDataActions } from '@/5-3-whatsapp/components/inbox/LivechatConversionMasterDataActions';
import type { Service } from '@/6-1-product-knowledge/hooks/useServices';
import type { SubService } from '@/6-1-product-knowledge/hooks/useSubServices';
import { resolveServiceByName } from '@/5-3-whatsapp/utils/livechatConversionValidation';

export type LivechatConversionLineServiceCategoryProps = {
  serviceName: string;
  categoryName: string;
  servicesList: Service[];
  subServicesList: SubService[];
  onServiceChange: (name: string) => void;
  onCategoryChange: (name: string) => void;
  onMasterDataRefresh: () => void;
  /** When line state is still empty, seed from quick-action / lead selection. */
  fallbackServiceName?: string;
  fallbackCategoryName?: string;
  disabled?: boolean;
  onFieldFocus?: (el: HTMLElement) => void;
  t: (key: string, fallback?: string, variables?: Record<string, string | number>) => string;
};

export function LivechatConversionLineServiceCategory({
  serviceName,
  categoryName,
  servicesList,
  subServicesList,
  onServiceChange,
  onCategoryChange,
  onMasterDataRefresh,
  fallbackServiceName = '',
  fallbackCategoryName = '',
  disabled = false,
  onFieldFocus,
  t,
}: LivechatConversionLineServiceCategoryProps) {
  const effectiveServiceName = serviceName.trim() || fallbackServiceName.trim();
  const effectiveCategoryName = categoryName.trim() || fallbackCategoryName.trim();

  const resolvedService = resolveServiceByName(effectiveServiceName, servicesList);
  const selectServiceValue = resolvedService?.name ?? (effectiveServiceName || undefined);

  const categoriesForService = resolvedService
    ? subServicesList.filter((ss) => ss.service_id === resolvedService.id)
    : [];

  const resolvedCategory =
    effectiveCategoryName &&
    categoriesForService.some((ss) => ss.name === effectiveCategoryName)
      ? effectiveCategoryName
      : undefined;

  useEffect(() => {
    if (serviceName.trim()) return;
    const seed = fallbackServiceName.trim();
    if (!seed) return;
    onServiceChange(seed);
    const cat = fallbackCategoryName.trim();
    if (cat) onCategoryChange(cat);
  }, [
    serviceName,
    fallbackServiceName,
    fallbackCategoryName,
    onServiceChange,
    onCategoryChange,
  ]);

  useEffect(() => {
    if (!effectiveServiceName || resolvedService) return;
    if (servicesList.length === 0) return;
    const match = resolveServiceByName(effectiveServiceName, servicesList);
    if (match && match.name !== serviceName) {
      onServiceChange(match.name);
    }
  }, [
    effectiveServiceName,
    resolvedService,
    servicesList,
    serviceName,
    onServiceChange,
  ]);

  const categoryDisabled = disabled || !effectiveServiceName;

  const categoryPlaceholder = !effectiveServiceName
    ? t('whatsappInbox.selectServiceFirst', 'Select service first')
    : !resolvedService
      ? t('whatsappInbox.selectServiceFromList', 'Choose a service from the list')
      : categoriesForService.length === 0
        ? t('whatsappInbox.noCategoriesForService', 'No categories for this service — add via ⋮ menu')
        : t('whatsappInbox.selectCategory', 'Select category');

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-gray-700">
            {t('whatsappInbox.service', 'Service')} <span className="text-red-500">*</span>
          </label>
          <LivechatConversionMasterDataActions
            kind="service"
            servicesList={servicesList}
            disabled={disabled}
            onRefresh={onMasterDataRefresh}
            onCreated={onServiceChange}
            t={t}
          />
        </div>
        <Select
          value={selectServiceValue}
          onValueChange={onServiceChange}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-9 w-full border-gray-200 bg-white text-sm"
            onFocus={(e) => onFieldFocus?.(e.currentTarget)}
          >
            <SelectValue placeholder={t('whatsappInbox.selectService', 'Select service')} />
          </SelectTrigger>
          <SelectContent>
            {servicesList.map((s) => (
              <SelectItem key={s.id} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {effectiveServiceName && !resolvedService ? (
          <p className="text-xs text-amber-700">
            {t(
              'whatsappInbox.serviceNotInMasterList',
              'Service on the lead is not in the active list — pick one from the dropdown.',
            )}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-gray-700">
            {t('whatsappInbox.category', 'Category')} <span className="text-red-500">*</span>
          </label>
          <LivechatConversionMasterDataActions
            kind="category"
            servicesList={servicesList}
            defaultServiceId={resolvedService?.id}
            disabled={disabled}
            onRefresh={onMasterDataRefresh}
            onCreated={onCategoryChange}
            t={t}
          />
        </div>
        <Select
          value={resolvedCategory}
          onValueChange={onCategoryChange}
          disabled={categoryDisabled}
        >
          <SelectTrigger
            className="h-9 w-full border-gray-200 bg-white text-sm"
            onFocus={(e) => onFieldFocus?.(e.currentTarget)}
          >
            <SelectValue placeholder={categoryPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {categoriesForService.map((ss) => (
              <SelectItem key={ss.id} value={ss.name}>
                {ss.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
