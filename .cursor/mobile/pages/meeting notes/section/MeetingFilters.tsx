import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from '@/features/ui/input';
import { Button } from '@/features/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/mobile/components/ui/drawer';
import { useMeetingNotes } from '@/features/8-1-meeting-notes/MeetingNotesContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', labelKey: 'meetingNotes.filters.allStatuses' as const },
  { value: 'Not Started', labelKey: 'meetingNotes.filters.notStarted' as const },
  { value: 'On Going', labelKey: 'meetingNotes.filters.onGoing' as const },
  { value: 'Completed', labelKey: 'meetingNotes.filters.completed' as const },
  { value: 'Rejected', labelKey: 'meetingNotes.filters.rejected' as const },
  { value: 'Presented', labelKey: 'meetingNotes.filters.presented' as const },
];

const TIME_OPTIONS = [
  { value: '', labelKey: 'meetingNotes.filters.allTime' as const },
  { value: 'Today', labelKey: 'meetingNotes.filters.today' as const },
  { value: 'Yesterday', labelKey: 'meetingNotes.filters.yesterday' as const },
  { value: 'This Week', labelKey: 'meetingNotes.filters.thisWeek' as const },
  { value: 'This Month', labelKey: 'meetingNotes.filters.thisMonth' as const },
  { value: 'Last Month', labelKey: 'meetingNotes.filters.lastMonth' as const },
];

const MeetingFilters = () => {
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [requestByDrawerOpen, setRequestByDrawerOpen] = useState(false);
  const [timeDrawerOpen, setTimeDrawerOpen] = useState(false);
  const {
    filters,
    setFilters,
    meetingPoints,
  } = useMeetingNotes();
  const { t } = useAppTranslation();

  const uniqueRequestBy = Array.from(
    new Set(
      meetingPoints
        .map((point) => point.request_by)
        .filter(Boolean)
    )
  ) as string[];

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({ ...prev, status: status || '' }));
  };

  const handleRequestByFilter = (requestBy: string) => {
    setFilters((prev) => ({ ...prev, requestBy: requestBy || '' }));
  };

  const handleTimeFilter = (timeFilter: string) => {
    setFilters((prev) => ({ ...prev, timeFilter: timeFilter || '' }));
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const statusLabel = filters.status || t('meetingNotes.filters.allStatuses', 'All Statuses');
  const requestByLabel = filters.requestBy || t('meetingNotes.filters.allRequestBy', 'All Request By');
  const timeLabel = filters.timeFilter || t('meetingNotes.filters.allTime', 'All Time');

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="text-sm font-medium text-foreground">{currentDate}</span>
      </div>

      <div className="flex flex-col gap-1.5 w-full">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder={t('meetingNotes.filters.searchPlaceholder', 'Search discussion points...')}
            className="pl-10 h-9 text-sm border-gray-200 w-full"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Three separate filter drawers in a row */}
        <div className="flex items-center gap-1.5 flex-nowrap w-full">
          {/* Status drawer */}
          <Drawer open={statusDrawerOpen} onOpenChange={setStatusDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-gray-200 flex-1 min-w-0 justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{statusLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('meetingNotes.filters.status', 'Status')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || 'all'}
                      type="button"
                      onClick={() => {
                        handleStatusFilter(opt.value);
                        setStatusDrawerOpen(false);
                      }}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm border transition-colors',
                        (opt.value ? filters.status === opt.value : !filters.status)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {t(opt.labelKey, opt.value || 'All Statuses')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">
                    {t('meetingNotes.filters.done', 'Done')}
                  </Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Request By drawer */}
          <Drawer open={requestByDrawerOpen} onOpenChange={setRequestByDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-gray-200 flex-1 min-w-0 justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{requestByLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('meetingNotes.filters.requestBy', 'Request By')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleRequestByFilter('');
                      setRequestByDrawerOpen(false);
                    }}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm border transition-colors',
                      !filters.requestBy
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    )}
                  >
                    {t('meetingNotes.filters.allRequestBy', 'All Request By')}
                  </button>
                  {uniqueRequestBy.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        handleRequestByFilter(name);
                        setRequestByDrawerOpen(false);
                      }}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm border transition-colors max-w-[200px] truncate',
                        filters.requestBy === name
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">
                    {t('meetingNotes.filters.done', 'Done')}
                  </Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Time drawer */}
          <Drawer open={timeDrawerOpen} onOpenChange={setTimeDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-gray-200 flex-1 min-w-0 justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{timeLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('meetingNotes.filters.time', 'Time')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || 'all'}
                      type="button"
                      onClick={() => {
                        handleTimeFilter(opt.value);
                        setTimeDrawerOpen(false);
                      }}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm border transition-colors',
                        (opt.value ? filters.timeFilter === opt.value : !filters.timeFilter)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {t(opt.labelKey, opt.value || 'All Time')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">
                    {t('meetingNotes.filters.done', 'Done')}
                  </Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  );
};

export default MeetingFilters;
