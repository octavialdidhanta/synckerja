
import React, { useState, useMemo } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Calendar, Bell, Clock } from 'lucide-react';
import { HolidayEvent } from '../../types/social-media';
import { ContentPillarTracker } from './ContentPillarTracker';
import { ContentBalanceTab } from './ContentBalanceTab';
// import { useOptimizedNationalHolidays } from '@/hooks/useOptimizedAttendanceData'; // Commented out - not available
import { format, differenceInDays, startOfDay } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { getDailyTasksRemindersQueryOptions } from '../../data/dashboardQueryOptions';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

interface ReminderTabProps {
  selectedMonth?: Date;
  serviceFilter?: string;
}

const ReminderTab: React.FC<ReminderTabProps> = ({ selectedMonth, serviceFilter }) => {
  const { t, language } = useAppTranslation();
  const dateLocale = language === 'id' ? id : enUS;
  // const { data: nationalHolidays = [], isLoading } = useOptimizedNationalHolidays(); // Commented out - hook not available
  const nationalHolidays: HolidayEvent[] = [];
  const isLoading = false;
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Get current organization
  const { organizationId } = useCurrentOrg();
  
  const { data: reminderTasks = [], isLoading: isLoadingReminders } = useQuery(
    getDailyTasksRemindersQueryOptions(organizationId),
  );

  // Helper function to determine holiday type based on name or country code
  const getHolidayType = (name: string, countryCode: string | null): 'national' | 'international' | 'religious' => {
    const nameLower = name.toLowerCase();
    
    // Religious holidays (Indonesian context)
    if (nameLower.includes('idul') || nameLower.includes('maulid') || nameLower.includes('isra') || 
        nameLower.includes('tahun baru islam') || nameLower.includes('waisak') || 
        nameLower.includes('natal') || nameLower.includes('nyepi') || nameLower.includes('galungan')) {
      return 'religious';
    }
    
    // International holidays
    if (nameLower.includes('internasional') || nameLower.includes('dunia') || nameLower.includes('sedunia') ||
        nameLower.includes('world') || nameLower.includes('international')) {
      return 'international';
    }
    
    // Default to national for country-specific holidays
    if (countryCode === 'ID' || !countryCode) {
      return 'national';
    }
    
    return 'national';
  };

  // Process holidays data
  const { currentMonthHolidays, upcomingHolidays } = useMemo(() => {
    const current: HolidayEvent[] = [];
    const upcoming: HolidayEvent[] = [];

    nationalHolidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      const holidayMonth = holidayDate.getMonth();
      const holidayYear = holidayDate.getFullYear();
      
      const holidayEvent: HolidayEvent = {
        date: holidayDate,
        name: holiday.name,
        type: getHolidayType(holiday.name, holiday.country_code),
        description: format(holidayDate, 'EEEE, dd MMMM yyyy')
      };

      // Current month holidays
      if (holidayMonth === currentMonth && holidayYear === currentYear) {
        current.push(holidayEvent);
      }
      // Upcoming holidays (future months in current year or next year)
      else if ((holidayYear === currentYear && holidayMonth > currentMonth) || 
               (holidayYear > currentYear)) {
        upcoming.push(holidayEvent);
      }
    });

    // Sort by date
    current.sort((a, b) => a.date.getTime() - b.date.getTime());
    upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      currentMonthHolidays: current,
      upcomingHolidays: upcoming.slice(0, 5) // Limit to 5 upcoming holidays
    };
  }, [nationalHolidays, currentMonth, currentYear]);

  // Get current month name
  const currentMonthName = format(currentDate, 'MMMM yyyy', { locale: dateLocale });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'national':
        return 'bg-red-100 text-red-800';
      case 'international':
        return 'bg-blue-100 text-blue-800';
      case 'religious':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'national':
        return t('reminderTab.holidays.type.national', 'National');
      case 'international':
        return t('reminderTab.holidays.type.international', 'International');
      case 'religious':
        return t('reminderTab.holidays.type.religious', 'Religious');
      default:
        return type;
    }
  };

  // Helper functions for calculating days remaining
  const getDaysRemaining = (dueDate: Date | null, isCompleted: boolean): number | null => {
    if (!dueDate || isCompleted) return null;
    const today = startOfDay(new Date());
    const due = startOfDay(dueDate);
    return differenceInDays(due, today);
  };

  const formatDaysRemaining = (days: number | null): string => {
    if (days === null) return '';
    if (days < 0) return applyVariables(t('reminderTab.daysAgo', '{{days}} days ago'), { days: String(Math.abs(days)) });
    if (days === 0) return t('reminderTab.today', 'Today');
    if (days === 1) return t('reminderTab.tomorrow', 'Tomorrow');
    return applyVariables(t('reminderTab.daysRemaining', '{{days}} days remaining'), { days: String(days) });
  };

  const reminderTabTriggerClass =
    'flex h-full min-h-0 w-full items-center justify-center rounded-none px-2 text-xs text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none';

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px]">
      <CardContent className="flex h-full min-h-0 flex-col overflow-hidden p-0">
        <Tabs defaultValue="funnel" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          {/* Tabs Header - Fixed — trigger aktif full height (tanpa inset dari padding list) */}
          <TabsList className="grid h-9 w-full flex-shrink-0 grid-cols-3 gap-0 overflow-hidden rounded-[5px] bg-muted p-0">
            <TabsTrigger value="funnel" className={reminderTabTriggerClass}>
              Funnel
            </TabsTrigger>
            <TabsTrigger value="content-balance" className={reminderTabTriggerClass}>
              Content Balance
            </TabsTrigger>
            <TabsTrigger value="pengingat" className={reminderTabTriggerClass}>
              {t('reminderTab.tab.pengingat', 'Reminders')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent
            value="funnel"
            className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden p-0 data-[state=inactive]:hidden"
          >
            <ContentPillarTracker selectedMonth={selectedMonth} serviceFilter={serviceFilter} />
          </TabsContent>

          <TabsContent
            value="content-balance"
            className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden p-0 data-[state=inactive]:hidden"
          >
            <ContentBalanceTab selectedMonth={selectedMonth} serviceFilter={serviceFilter} />
          </TabsContent>

          <TabsContent
            value="pengingat"
            className="m-0 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-2 seamless-scroll nested-scroll-touch-chain data-[state=inactive]:hidden"
          >
            {/* Daily Task Reminders */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4 text-yellow-600" />
                {t('reminderTab.title', 'Task Reminders')}
              </h3>
              <div className="space-y-2">
                {isLoadingReminders ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-gray-500">{t('reminderTab.loading', 'Loading reminders...')}</div>
                  </div>
                ) : reminderTasks.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-gray-500">{t('reminderTab.noReminders', 'No task reminders')}</div>
                  </div>
                ) : (
                  reminderTasks.map((task: any) => {
                    const dueDate = task.due_date ? new Date(task.due_date) : null;
                    const isCompleted = task.status === 'completed';
                    const isOverdue = dueDate && dueDate < new Date() && !isCompleted;
                    const daysRemaining = getDaysRemaining(dueDate, isCompleted);
                    
                    return (
                      <div 
                        key={task.id} 
                        className={`flex items-start gap-2 p-2 border rounded ${
                          isOverdue 
                            ? 'bg-red-50 border-red-200' 
                            : isCompleted 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <Bell className={`w-4 h-4 ${
                            isOverdue 
                              ? 'text-red-600' 
                              : isCompleted 
                              ? 'text-green-600' 
                              : 'text-yellow-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-gray-900 mb-1">
                            {task.title || t('reminderTab.noTitle', 'No Title')}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          {dueDate && (
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-500" />
                                <span className={
                                  isOverdue 
                                    ? 'text-red-600 font-medium' 
                                    : isCompleted 
                                    ? 'text-green-600' 
                                    : 'text-gray-600'
                                }>
                                  {applyVariables(t('reminderTab.dueDate', 'Due date: {{date}}'), { date: format(dueDate, 'dd MMM yyyy', { locale: dateLocale }) })}
                                </span>
                              </div>
                              {daysRemaining !== null && (
                                <span className={`text-xs ml-4 ${
                                  daysRemaining < 0 
                                    ? 'text-red-500 font-medium' 
                                    : daysRemaining === 0 
                                    ? 'text-orange-500 font-medium' 
                                    : daysRemaining <= 3 
                                    ? 'text-yellow-600' 
                                    : 'text-gray-500'
                                }`}>
                                  {formatDaysRemaining(daysRemaining)}
                                </span>
                              )}
                            </div>
                          )}
                          {isOverdue && (
                            <Badge className="mt-1 text-xs bg-red-100 text-red-800">
                              {t('reminderTab.overdue', 'Overdue')}
                            </Badge>
                          )}
                          {isCompleted && !isOverdue && (
                            <Badge className="mt-1 text-xs bg-green-100 text-green-800">
                              {t('reminderTab.completed', 'Completed')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <Separator />

            {/* Current Month Holidays */}
            <div>
              <h3 className="font-semibold text-sm mb-2">
                {applyVariables(t('reminderTab.holidays.currentMonth', 'Important Days in {{month}}'), { month: currentMonthName })}
              </h3>
              <div className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-gray-500">{t('reminderTab.holidays.loading', 'Loading important days...')}</div>
                  </div>
                ) : currentMonthHolidays.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-gray-500">{t('reminderTab.holidays.noCurrentMonth', 'No important days this month')}</div>
                  </div>
                ) : (
                  currentMonthHolidays.map((holiday, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 border rounded">
                    <div className="text-center min-w-[40px]">
                      <div className="text-lg font-bold text-blue-600">
                        {holiday.date.getDate().toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs text-gray-500 uppercase">
                        {holiday.date.toLocaleDateString('en', {
                          month: 'short'
                        })}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{holiday.name}</h4>
                      <p className="text-xs text-gray-500">{holiday.description}</p>
                      <Badge className={`mt-1 text-xs ${getTypeColor(holiday.type)}`}>
                        {getTypeLabel(holiday.type)}
                      </Badge>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Upcoming Holidays */}
            <div>
              <h3 className="font-semibold text-sm mb-2">{t('reminderTab.holidays.upcoming', 'Upcoming Important Days')}</h3>
              <div className="space-y-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="text-sm text-gray-500">{t('reminderTab.holidays.loadingShort', 'Loading...')}</div>
                  </div>
                ) : upcomingHolidays.length === 0 ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="text-sm text-gray-500">{t('reminderTab.holidays.noUpcoming', 'No upcoming important days')}</div>
                  </div>
                ) : (
                  upcomingHolidays.map((holiday, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                    <div className="text-center min-w-[30px]">
                      <div className="text-sm font-bold text-yellow-600">
                        {holiday.date.getDate()}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{holiday.name}</h4>
                      <Badge className={`mt-1 text-xs ${getTypeColor(holiday.type)}`}>
                        {getTypeLabel(holiday.type)}
                      </Badge>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Sidebar Footer */}
        <div className="px-3 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className="font-medium">Dashboard Overview</span>
            <span className="text-xs text-gray-500">Real-time</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { ReminderTab };
export default ReminderTab;
