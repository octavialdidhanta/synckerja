import { useMemo } from 'react';
import { format } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { ContentPlan } from '@/6-1-dashboard/types/social-media';

interface MonthlyStats {
  total: number;
  red: number;
  orange: number;
  yellow: number;
  green: number;
  greenWithLate: number;
}

interface ServiceOption {
  id: string;
  name?: string | null;
}

interface ContentCalendarSidebarFooterProps {
  monthlyStats: MonthlyStats;
  plansByDate: Record<string, ContentPlan[]>;
  currentDate: Date;
  serviceFilter?: string;
  services?: ServiceOption[];
}

export function ContentCalendarSidebarFooter({
  monthlyStats,
  plansByDate,
  currentDate,
  serviceFilter = 'all',
  services = [],
}: ContentCalendarSidebarFooterProps) {
  const { t, dateFnsLocale } = useAppTranslation();

  const monthYear = format(currentDate, 'MMM yyyy', { locale: dateFnsLocale });

  const serviceLabel = useMemo(() => {
    if (serviceFilter === 'all') {
      return t('contentCalendar.sidebarFooter.allServices', 'All services');
    }
    const found = services.find((s) => s.id === serviceFilter);
    return found?.name?.trim() || t('contentCalendar.sidebarFooter.filteredService', 'Filtered service');
  }, [serviceFilter, services, t]);

  const upcomingWeekCount = useMemo(() => {
    const today = new Date();
    return Object.entries(plansByDate).reduce((acc, [dateKey, plans]) => {
      const date = new Date(dateKey);
      const daysFromNow = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysFromNow >= 0 && daysFromNow <= 7) {
        return acc + (Array.isArray(plans) ? plans.length : 0);
      }
      return acc;
    }, 0);
  }, [plansByDate]);

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-1">
      <div className="flex min-h-8 flex-wrap items-center gap-x-1 gap-y-0.5 text-xs leading-normal text-gray-500">
        <span className="shrink-0 tabular-nums" title={monthYear}>
          {monthYear}
        </span>
        <span className="text-gray-300" aria-hidden>
          ·
        </span>
        <span className="shrink-0 tabular-nums text-gray-600">
          {t(
            'contentCalendar.sidebarFooter.postsThisMonth',
            '{{count}} posts',
            { count: monthlyStats.total },
          )}
        </span>
        <span className="text-gray-300" aria-hidden>
          ·
        </span>
        <span className="min-w-0 truncate" title={serviceLabel}>
          {serviceLabel}
        </span>
        {upcomingWeekCount > 0 ? (
          <>
            <span className="text-gray-300" aria-hidden>
              ·
            </span>
            <span className="shrink-0 tabular-nums">
              {t(
                'contentCalendar.sidebarFooter.upcomingWeek',
                '{{count}} in 7d',
                { count: upcomingWeekCount },
              )}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
