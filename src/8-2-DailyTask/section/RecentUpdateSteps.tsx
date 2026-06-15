import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Edit, Plus, RotateCcw, Calendar, FilterX } from 'lucide-react';
import { useDailyTask } from '../context/DailyTaskContext';
import { hideScrollbarClassName } from '../lib/hideScrollbar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';

const RecentUpdateSteps = () => {
  const { t } = useAppTranslation();
  const { filteredTasks, filteredRecentStepUpdates, recentStepFilters, setRecentStepFilters, isLoading, navigateToTask } = useDailyTask();
  const displayUpdates = React.useMemo(() => {
    const ids = new Set((filteredTasks || []).map((task) => task.id));
    return (filteredRecentStepUpdates || []).filter((u) => ids.has(u.task_id));
  }, [filteredTasks, filteredRecentStepUpdates]);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [clickedUpdateId, setClickedUpdateId] = useState<string | null>(null);

  // Clear click highlight after 2s; cleanup on unmount to avoid setState after unmount
  useEffect(() => {
    if (!clickedUpdateId) return;
    const id = setTimeout(() => setClickedUpdateId(null), 2000);
    return () => clearTimeout(id);
  }, [clickedUpdateId]);

  const getActionIcon = (action: string, _isCompleted: boolean) => {
    switch (action) {
      case 'completed':
        return <CheckSquare className="w-3 h-3 text-green-600" />;
      case 'created':
        return <Plus className="w-3 h-3 text-blue-600" />;
      case 'reopened':
        return <RotateCcw className="w-3 h-3 text-orange-600" />;
      case 'updated':
      default:
        return <Edit className="w-3 h-3 text-gray-600" />;
    }
  };

  const getActionText = (action: string, _isCompleted: boolean) => {
    switch (action) {
      case 'completed':
        return t('dailyTask.recentUpdates.completed', 'Completed');
      case 'created':
        return t('dailyTask.recentUpdates.created', 'Created');
      case 'reopened':
        return t('dailyTask.recentUpdates.reopened', 'Reopened');
      case 'updated':
      default:
        return t('dailyTask.recentUpdates.updated', 'Updated');
    }
  };

  const getActionColor = (action: string, isCompleted: boolean) => {
    switch (action) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'created':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'reopened':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'updated':
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return t('dailyTask.recentUpdates.justNow', 'Just now');
    if (diffInMinutes < 60) return t('dailyTask.recentUpdates.minutesAgo', '{{count}}m ago', { count: diffInMinutes });
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return t('dailyTask.recentUpdates.hoursAgo', '{{count}}h ago', { count: diffInHours });
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return t('dailyTask.recentUpdates.daysAgo', '{{count}}d ago', { count: diffInDays });
    return date.toLocaleDateString();
  };

  if (isLoading) return null;

  const handleDateRangeChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setRecentStepFilters(prev => ({
        ...prev,
        dateRange: value as any,
        customStartDate: undefined,
        customEndDate: undefined
      }));
    }
  };

  const handleCustomDateChange = (startDate: string, endDate: string) => {
    setRecentStepFilters(prev => ({
      ...prev,
      dateRange: 'custom',
      customStartDate: startDate,
      customEndDate: endDate
    }));
    setShowCustomDatePicker(false);
  };

  const clearFilters = () => {
    setRecentStepFilters({
      dateRange: 'today',
      actionType: 'all'
    });
  };

  const handleStepUpdateClick = (update: any) => {
    setClickedUpdateId(update.id);
    navigateToTask(update.task_id, update.step_id);
  };

  if (displayUpdates.length === 0 && !isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('dailyTask.recentUpdates.title', 'Recent Step Updates')}
          </h4>
        </div>
        <div className="text-center text-gray-500 text-sm">{t('dailyTask.recentUpdates.noUpdates', 'No updates found for selected filters')}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t('dailyTask.recentUpdates.title', 'Recent Step Updates')}
        </h4>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={recentStepFilters.dateRange} onValueChange={handleDateRangeChange}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('dailyTask.recentUpdates.today', 'Today')}</SelectItem>
            <SelectItem value="yesterday">{t('dailyTask.recentUpdates.yesterday', 'Yesterday')}</SelectItem>
            <SelectItem value="this_week">{t('dailyTask.recentUpdates.thisWeek', 'This Week')}</SelectItem>
            <SelectItem value="this_month">{t('dailyTask.recentUpdates.thisMonth', 'This Month')}</SelectItem>
            <SelectItem value="last_month">{t('dailyTask.recentUpdates.lastMonth', 'Last Month')}</SelectItem>
            <SelectItem value="custom">{t('dailyTask.recentUpdates.customRange', 'Custom Range')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Select 
            value={recentStepFilters.actionType} 
            onValueChange={(value) => setRecentStepFilters(prev => ({ ...prev, actionType: value as any }))}
          >
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dailyTask.recentUpdates.allActions', 'All Actions')}</SelectItem>
              <SelectItem value="completed">{t('dailyTask.recentUpdates.completed', 'Completed')}</SelectItem>
              <SelectItem value="updated">{t('dailyTask.recentUpdates.updated', 'Updated')}</SelectItem>
              <SelectItem value="created">{t('dailyTask.recentUpdates.created', 'Created')}</SelectItem>
              <SelectItem value="reopened">{t('dailyTask.recentUpdates.reopened', 'Reopened')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
            title={t('dailyTask.recentUpdates.clearFilters', 'Clear Filters')}
          >
            <FilterX className="w-4 h-4" />
          </Button>
        </div>

        {recentStepFilters.dateRange === 'custom' && (
          <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                {t('dailyTask.recentUpdates.customRange', 'Custom Range')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('dailyTask.recentUpdates.startDate', 'Start Date')}</label>
                  <Input
                    type="date"
                    value={recentStepFilters.customStartDate || ''}
                    onChange={(e) => setRecentStepFilters(prev => ({ ...prev, customStartDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('dailyTask.recentUpdates.endDate', 'End Date')}</label>
                  <Input
                    type="date"
                    value={recentStepFilters.customEndDate || ''}
                    onChange={(e) => setRecentStepFilters(prev => ({ ...prev, customEndDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (recentStepFilters.customStartDate && recentStepFilters.customEndDate) {
                        handleCustomDateChange(recentStepFilters.customStartDate, recentStepFilters.customEndDate);
                      }
                    }}
                    disabled={!recentStepFilters.customStartDate || !recentStepFilters.customEndDate}
                  >
                    {t('dailyTask.recentUpdates.apply', 'Apply')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCustomDatePicker(false)}
                  >
                    {t('dailyTask.recentUpdates.cancel', 'Cancel')}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      
      <div className={`space-y-3 max-h-64 min-h-0 overflow-y-auto overflow-x-hidden ${hideScrollbarClassName}`}>
        {displayUpdates.map((update) => {
          const isClicked = clickedUpdateId === update.id;
          return (
          <div
            key={update.id}
            className={`flex items-start gap-3 p-2 rounded-md transition-all duration-300 cursor-pointer ${
              isClicked 
                ? 'bg-blue-100 border-l-4 border-l-blue-500 shadow-sm' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => handleStepUpdateClick(update)}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getActionIcon(update.action, update.is_completed)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getActionColor(update.action, update.is_completed)}`}
                >
                  {getActionText(update.action, update.is_completed)}
                </Badge>
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(update.updated_at)}
                </span>
              </div>
              
              <div className="text-sm font-medium text-gray-900 truncate">
                {update.step_title}
              </div>
              
              <div className="text-xs text-gray-500 truncate">
                from "{update.task_title}"
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentUpdateSteps;
