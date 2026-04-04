import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

const indonesianMonths = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface Service {
  id: string;
  name: string;
}

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  services: Service[];
  selectedService: string;
  onServiceChange: (serviceId: string) => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrevMonth,
  onNextMonth,
  services,
  selectedService,
  onServiceChange
}) => {
  const { t } = useAppTranslation();

  /** Legend order: content plan → production → posted (completed) */
  const legendItems = [
    { swatch: 'bg-red-500 rounded shadow-sm', key: 'contentCalendar.legend.notApproved' },
    { swatch: 'bg-orange-500 rounded shadow-sm', key: 'contentCalendar.legend.contentPlanApproved' },
    { swatch: 'bg-amber-400 rounded shadow-sm', key: 'contentCalendar.legend.productionApproved' },
    { swatch: 'bg-gray-500 dark:bg-slate-600 rounded shadow-sm ring-1 ring-gray-400/50', key: 'contentCalendar.legend.productionNeedReview' },
    { swatch: 'bg-red-800 dark:bg-red-950 rounded shadow-sm ring-1 ring-red-700/40', key: 'contentCalendar.legend.productionRevision' },
    { swatch: 'bg-green-500 rounded shadow-sm', key: 'contentCalendar.legend.completed' },
    { swatch: 'bg-green-500 rounded shadow-sm border-2 border-red-500', key: 'contentCalendar.legend.completedLate' },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Main Header */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Content Planning Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium min-w-[200px] text-center">
            {indonesianMonths[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>
          <Button variant="outline" size="sm" onClick={onNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Legend and Service Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {legendItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <div className={`w-3 h-3 shrink-0 ${item.swatch}`} />
              <span className="text-gray-700 dark:text-gray-300">{t(item.key)}</span>
            </div>
          ))}
        </div>
        
        {/* Service Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select value={selectedService} onValueChange={onServiceChange}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filter by Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
