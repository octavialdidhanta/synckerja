import { format } from 'date-fns';
import { Calendar, CheckCircle2, Clock, AlertCircle, FileEdit } from 'lucide-react';
import { ContentPlan } from '@/6-1-dashboard/types/social-media';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ContentBalanceTab } from '@/6-1-dashboard/container/RightSection/ContentBalanceTab';
import { ContentPillarTracker } from '@/6-1-dashboard/container/RightSection/ContentPillarTracker';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { ContentCalendarSidebarFooter } from './ContentCalendarSidebarFooter';

/** Selaras dengan tab Funnel / Content Balance / Reminders di dashboard (`ReminderTab`). */
const overviewTabsTriggerClass =
  'flex h-full min-h-0 w-full items-center justify-center rounded-none px-2 text-xs text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none';

interface MonthlyStats {
  total: number;
  red: number;
  orange: number;
  yellow: number;
  green: number;
  greenWithLate: number;
}

// Using ContentPlan from dashboard types

interface ContentCalendarOverviewProps {
  monthlyStats: MonthlyStats;
  plansByDate: { [key: string]: ContentPlan[] };
  contentPlans: ContentPlan[];
  currentDate: Date;
  serviceFilter?: string;
  services?: { id: string; name?: string | null }[];
}

export const ContentCalendarOverview = ({
  monthlyStats,
  plansByDate,
  contentPlans,
  currentDate,
  serviceFilter,
  services = [],
}: ContentCalendarOverviewProps) => {
  const { t } = useAppTranslation();
  const monthName = format(currentDate, 'MMMM yyyy');

  // Calculate upcoming posts (next 7 days)
  const today = new Date();
  const upcomingPosts = Object.entries(plansByDate)
    .filter(([dateKey]) => {
      const date = new Date(dateKey);
      const daysFromNow = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysFromNow >= 0 && daysFromNow <= 7;
    })
    .flatMap(([_, plans]) => plans)
    .slice(0, 5);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[5px] border bg-white">
      <Tabs defaultValue="overview" className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b px-4 pb-2 pt-2">
          <TabsList className="mb-2 grid h-9 w-full grid-cols-3 gap-0 overflow-hidden rounded-[5px] bg-muted p-0">
            <TabsTrigger value="overview" className={overviewTabsTriggerClass}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="funnel" className={overviewTabsTriggerClass}>
              Funnel
            </TabsTrigger>
            <TabsTrigger value="content-balance" className={overviewTabsTriggerClass}>
              Content Balance
            </TabsTrigger>
          </TabsList>
          <p className="text-xs text-gray-500">{monthName}</p>
        </div>

        <TabsContent
          value="overview"
          className="m-0 min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4 seamless-scroll nested-scroll-touch-chain data-[state=inactive]:hidden"
        >
        {/* Monthly Statistics */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-700 mb-3">Monthly Statistics</h4>
          
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-600">Total Posts</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{monthlyStats.total}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-red-50 rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-600">{t('contentCalendar.legend.notApproved')}</span>
            </div>
            <span className="text-sm font-semibold text-red-600">{monthlyStats.red}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-gray-600">{t('contentCalendar.legend.contentPlanApproved')}</span>
            </div>
            <span className="text-sm font-semibold text-orange-600">{monthlyStats.orange}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
            <div className="flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-gray-600">{t('contentCalendar.legend.productionApproved')}</span>
            </div>
            <span className="text-sm font-semibold text-amber-600">{monthlyStats.yellow}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-600">{t('contentCalendar.legend.completed')}</span>
            </div>
            <span className="text-sm font-semibold text-green-600">{monthlyStats.green}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-green-100 rounded border border-green-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <span className="text-xs text-gray-700 font-medium">{t('contentCalendar.legend.completedLate')}</span>
            </div>
            <span className="text-sm font-semibold text-green-700">{monthlyStats.greenWithLate}</span>
          </div>
        </div>

        {/* Upcoming Posts */}
        {upcomingPosts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-700 mb-3">Upcoming Posts (Next 7 Days)</h4>
            {upcomingPosts.map((post, index) => (
              <div key={post.id || index} className="p-2 bg-gray-50 rounded space-y-1">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {post.title || 'Untitled Post'}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(post.post_date), 'MMM dd, yyyy')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        </TabsContent>

        <TabsContent
          value="funnel"
          className="m-0 min-h-0 flex-1 overflow-hidden p-0 data-[state=inactive]:hidden"
        >
          <ContentPillarTracker selectedMonth={currentDate} serviceFilter={serviceFilter} />
        </TabsContent>

        <TabsContent
          value="content-balance"
          className="m-0 min-h-0 flex-1 overflow-hidden p-0 data-[state=inactive]:hidden"
        >
          <ContentBalanceTab selectedMonth={currentDate} serviceFilter={serviceFilter} />
        </TabsContent>
      </Tabs>

      <ContentCalendarSidebarFooter
        monthlyStats={monthlyStats}
        plansByDate={plansByDate}
        currentDate={currentDate}
        serviceFilter={serviceFilter}
        services={services}
      />
    </div>
  );
};

