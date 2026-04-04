/**
 * Dropdown Status lead — kode sama dengan sidebar livechat.
 * Dipakai di: LivechatQuickActionPanel (sidebar) dan LeadsTableNew (leads-management).
 */
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getLeadStatusDisplayName } from '../utils/leadStatusDisplay';

export interface LeadStatusOption {
  id: string;
  name: string;
  color: string;
}

function getStatusColorClass(status: LeadStatusOption | null | undefined): string {
  if (!status?.color) return 'bg-gray-50 text-gray-700 border-gray-200';
  const colorMap: Record<string, string> = {
    '#F59E0B': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    '#10B981': 'bg-green-50 text-green-700 border-green-200',
    '#059669': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '#EF4444': 'bg-red-50 text-red-700 border-red-200',
    '#6B7280': 'bg-gray-50 text-gray-700 border-gray-200',
    '#3B82F6': 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return colorMap[status.color] ?? 'bg-gray-50 text-gray-700 border-gray-200';
}

// Urutan status (progression): status dengan order lebih kecil tidak bisa dipilih ketika status saat ini lebih tinggi
const STATUS_ORDER: Record<string, number> = {
  open: 0,
  unread: 0,
  'in progress': 1,
  qualified: 2,
  converted: 3,
  closed: 4,
  resolve: 4,
  lost: 4,
};

function getStatusOrder(name: string | null | undefined): number {
  if (name == null || name === '') return -1;
  const key = name.trim().toLowerCase();
  return key in STATUS_ORDER ? STATUS_ORDER[key] : 999;
}

export interface LeadStatusSelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  leadStatuses: LeadStatusOption[];
  /** Nama status saat ini di DB (Open, In Progress, Closed, dll) — untuk mengunci opsi Unread */
  currentStatusName: string;
  disabled?: boolean;
  /** ClassName untuk SelectTrigger (sidebar: w-full text-sm rounded-lg; table: w-28 h-7 text-xs rounded-sm) */
  triggerClassName?: string;
  placeholder?: string;
  isLoading?: boolean;
}

export function LeadStatusSelect({
  value,
  onValueChange,
  leadStatuses,
  currentStatusName,
  disabled = false,
  triggerClassName = 'w-full text-sm border rounded-lg font-medium',
  placeholder,
  isLoading = false,
}: LeadStatusSelectProps) {
  const { t } = useAppTranslation();
  // Deduplicate by display name so dropdown never shows duplicate labels (e.g. same name, different id from DB)
  const uniqueStatuses = React.useMemo(() => {
    const seen = new Set<string>();
    const result: LeadStatusOption[] = [];
    for (const s of leadStatuses) {
      const labelKey = getLeadStatusDisplayName(s.name).trim().toLowerCase();
      if (labelKey === '') continue;
      if (seen.has(labelKey)) {
        // If this is the currently selected status, replace so selection stays visible
        if (value && s.id === value) {
          const idx = result.findIndex(
            (r) => getLeadStatusDisplayName(r.name).trim().toLowerCase() === labelKey
          );
          if (idx >= 0) result[idx] = s;
        }
        continue;
      }
      seen.add(labelKey);
      result.push(s);
    }
    return result;
  }, [leadStatuses, value]);
  const currentStatus = uniqueStatuses.find((s) => s.id === value);
  const currentOrder = Math.max(
    getStatusOrder(currentStatusName),
    getStatusOrder(currentStatus?.name ?? '')
  );

  /** Nonaktifkan opsi yang order-nya lebih kecil dari status saat ini (tidak bisa mundur). */
  const isOptionDisabled = (statusName: string) => {
    const order = getStatusOrder(statusName);
    if (order < 0) return false;
    return order < currentOrder;
  };

  if (isLoading) {
    return (
      <div className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        ...
      </div>
    );
  }

  if (uniqueStatuses.length === 0) {
    return (
      <div className="text-xs text-gray-500">
        {t('whatsappInbox.noStatuses', 'No statuses configured')}
      </div>
    );
  }

  const handleValueChange = (newValue: string) => {
    const newStatus = uniqueStatuses.find((s) => s.id === newValue);
    if (newStatus && isOptionDisabled(newStatus.name ?? '')) return;
    onValueChange(newValue);
  };

  return (
    <Select value={value ?? undefined} onValueChange={handleValueChange}>
      <SelectTrigger
        className={`${triggerClassName} ${getStatusColorClass(currentStatus ?? undefined)}`}
        disabled={disabled}
      >
        <SelectValue placeholder={placeholder ?? t('whatsappInbox.selectStatus', 'Select status')} />
      </SelectTrigger>
      <SelectContent>
        {uniqueStatuses
          .filter(
            (s) =>
              (s.name ?? '').trim().toLowerCase() !== 'lost' &&
              (s.name ?? '').trim().toLowerCase() !== 'qualified'
          )
          .map((status) => {
            const optionDisabled = isOptionDisabled(status.name ?? '');
            return (
              <SelectItem
                key={status.id}
                value={status.id}
                disabled={optionDisabled}
                className={optionDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none select-none' : undefined}
                title={
                  optionDisabled
                    ? t('leadsManagement.statusCannotGoBack', 'Status tidak dapat dikembalikan ke tahap sebelumnya')
                    : undefined
                }
              >
                {getLeadStatusDisplayName(status.name)}
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
  );
}
