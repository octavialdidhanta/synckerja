import React, { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/features/ui/radio-group';
import { Label } from '@/features/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/ui/select';
import { LeadsFilters } from '@/features/5-3-dashboard/LeadsFilters';
import { getLeadStatusDisplayName } from '@/features/5-3-leads-management/leadStatusDisplay';
import { useAvailableEmployees } from '@/features/share/hooks/useAvailableEmployees';
import { supabase } from '@/integrations/supabase/client';
import { CustomDatePicker } from '@/mobile/components/CustomDatePicker';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

interface LeadStatus {
  id: string;
  name: string;
  description?: string;
  color?: string | null;
}

interface LeadSource {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
}

interface MobileLeadsFilterDrawerProps {
  filters: LeadsFilters;
  onFiltersChange: (filters: LeadsFilters) => void;
  onAfterDateSelect?: () => void;
}

const DATE_PRESET_VALUES = [
  'today',
  'yesterday',
  'last7days',
  'last14days',
  'last28days',
  'last30days',
  'thisweek',
  'lastweek',
  'thismonth',
  'lastmonth',
  'maximum',
  'custom',
] as const;

function getDateRangeForPreset(preset: string): DateRange | null {
  const today = new Date();
  const yesterday = subDays(today, 1);
  switch (preset) {
    case 'today':
      return { from: startOfDay(today), to: endOfDay(today) };
    case 'yesterday':
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    case 'last7days':
      return { from: startOfDay(subDays(today, 6)), to: endOfDay(today) };
    case 'last14days':
      return { from: startOfDay(subDays(today, 13)), to: endOfDay(today) };
    case 'last28days':
      return { from: startOfDay(subDays(today, 27)), to: endOfDay(today) };
    case 'last30days':
      return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) };
    case 'thisweek':
      return { from: startOfWeek(today, { weekStartsOn: 0 }), to: endOfWeek(today, { weekStartsOn: 0 }) };
    case 'lastweek':
      return {
        from: startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }),
        to: endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }),
      };
    case 'thismonth':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'lastmonth':
      return { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) };
    case 'maximum':
      return null;
    default:
      return null;
  }
}

function getPresetFromRange(dateRange: DateRange | null): string {
  if (!dateRange?.from || !dateRange?.to) return 'maximum';
  const from = dateRange.from;
  const to = dateRange.to;
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(from, to) && sameDay(from, today)) return 'today';
  const yesterday = subDays(today, 1);
  if (sameDay(from, to) && sameDay(from, yesterday)) return 'yesterday';
  for (const preset of DATE_PRESET_VALUES) {
    if (preset === 'maximum' || preset === 'custom') continue;
    const range = getDateRangeForPreset(preset);
    if (range?.from && range?.to && from.getTime() === range.from.getTime() && to.getTime() === range.to.getTime()) {
      return preset;
    }
  }
  return 'custom';
}

export function MobileLeadsFilterDrawer({
  filters,
  onFiltersChange,
  onAfterDateSelect,
}: MobileLeadsFilterDrawerProps) {
  const { t } = useAppTranslation();
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const { data: employees = [] } = useAvailableEmployees();

  useEffect(() => {
    const fetchOptions = async () => {
      const [statusRes, sourceRes, serviceRes] = await Promise.all([
        supabase.from('lead_statuses').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('lead_sources').select('*').eq('is_active', true).order('name'),
        supabase.from('services').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (statusRes.data) setLeadStatuses(statusRes.data);
      if (sourceRes.data) setLeadSources(sourceRes.data);
      if (serviceRes.data) setServices(serviceRes.data);
    };
    fetchOptions();
  }, []);

  const datePreset = getPresetFromRange(filters.dateRange);

  const updateFilters = (key: keyof LeadsFilters, value: string | DateRange | null) => {
    const next = { ...filters, [key]: value };
    onFiltersChange(next);
  };

  const handleDatePresetChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomDateOpen(true);
      return;
    }
    const range = getDateRangeForPreset(value);
    updateFilters('dateRange', range);
    onAfterDateSelect?.();
  };

  const handleCustomDateSelect = (startDate: Date, endDate: Date) => {
    updateFilters('dateRange', { from: startDate, to: endDate });
    setIsCustomDateOpen(false);
    onAfterDateSelect?.();
  };

  const dateLabels: Record<string, string> = {
    today: t('leadsManagement.filter.today', 'Today'),
    yesterday: t('leadsManagement.filter.yesterday', 'Yesterday'),
    last7days: t('leadsManagement.filter.last7days', 'Last 7 days'),
    last14days: t('leadsManagement.filter.last14days', 'Last 14 days'),
    last28days: t('leadsManagement.filter.last28days', 'Last 28 days'),
    last30days: t('leadsManagement.filter.last30days', 'Last 30 days'),
    thisweek: t('leadsManagement.filter.thisweek', 'This week'),
    lastweek: t('leadsManagement.filter.lastweek', 'Last week'),
    thismonth: t('leadsManagement.filter.thismonth', 'This month'),
    lastmonth: t('leadsManagement.filter.lastmonth', 'Last month'),
    maximum: t('leadsManagement.filter.maximum', 'Maximum'),
    custom: t('leadsManagement.filter.custom', 'Custom'),
  };

  const uniqueStatuses = React.useMemo(() => {
    const seen = new Set<string>();
    return leadStatuses.filter((s) => {
      const display = getLeadStatusDisplayName(s.name);
      if (seen.has(display)) return false;
      seen.add(display);
      return true;
    });
  }, [leadStatuses]);

  return (
    <>
      <div className="grid gap-4 px-4 pb-4 text-left">
        <div className="grid gap-2">
          <Label className="text-sm font-medium text-foreground">
            {t('leadsManagement.filter.dateRange', 'Date range')}
          </Label>
          <RadioGroup value={datePreset} onValueChange={handleDatePresetChange}>
            {DATE_PRESET_VALUES.map((value) => (
              <div key={value} className="flex items-center space-x-2 py-1">
                <RadioGroupItem value={value} id={`date-${value}`} />
                <Label htmlFor={`date-${value}`} className="text-sm font-normal cursor-pointer flex-1">
                  {dateLabels[value] ?? value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-foreground">
            {t('leadsManagement.filter.source', 'Source')}
          </Label>
          <Select value={filters.source} onValueChange={(v) => updateFilters('source', v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t('leadsManagement.filter.allSources', 'All Sources')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leadsManagement.filter.allSources', 'All Sources')}</SelectItem>
              {leadSources.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-foreground">
            {t('leadsManagement.filter.service', 'Service')}
          </Label>
          <Select value={filters.services} onValueChange={(v) => updateFilters('services', v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t('leadsManagement.filter.allServices', 'All Services')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leadsManagement.filter.allServices', 'All Services')}</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-foreground">
            {t('leadsManagement.filter.assignee', 'Assignee')}
          </Label>
          <Select value={filters.assignee} onValueChange={(v) => updateFilters('assignee', v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t('leadsManagement.filter.allAssignees', 'All Assignees')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leadsManagement.filter.allAssignees', 'All Assignees')}</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.full_name || emp.email || ''}>
                  {emp.full_name || emp.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label className="text-sm font-medium text-foreground">
            {t('leadsManagement.filter.status', 'Status')}
          </Label>
          <Select value={filters.status} onValueChange={(v) => updateFilters('status', v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t('leadsManagement.filter.allStatus', 'All Status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leadsManagement.filter.allStatus', 'All Status')}</SelectItem>
              {uniqueStatuses.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {getLeadStatusDisplayName(s.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CustomDatePicker
        isOpen={isCustomDateOpen}
        onClose={() => setIsCustomDateOpen(false)}
        onDateRangeSelect={handleCustomDateSelect}
        initialStartDate={filters.dateRange?.from ? new Date(filters.dateRange.from) : undefined}
        initialEndDate={filters.dateRange?.to ? new Date(filters.dateRange.to) : undefined}
      />
    </>
  );
}
