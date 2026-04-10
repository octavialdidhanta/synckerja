import React, { useState } from 'react';
import { Search, RefreshCw, ChevronDown } from 'lucide-react';
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
import { useDailyTaskReport } from '@/features/8-2-DailyTaskReport/context/ReportContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'all', labelKey: 'dailyTaskReport.filters.all' as const },
  { value: 'ontime', labelKey: 'dailyTaskReport.filters.onTime' as const },
  { value: 'late', labelKey: 'dailyTaskReport.filters.late' as const },
];

const TIME_OPTIONS = [
  { value: 'all', labelKey: 'dailyTaskReport.filters.allTime' as const },
  { value: 'today', labelKey: 'dailyTaskReport.filters.today' as const },
  { value: 'yesterday', labelKey: 'dailyTaskReport.filters.yesterday' as const },
  { value: 'this_week', labelKey: 'dailyTaskReport.filters.thisWeek' as const },
  { value: 'this_month', labelKey: 'dailyTaskReport.filters.thisMonth' as const },
  { value: 'last_month', labelKey: 'dailyTaskReport.filters.lastMonth' as const },
  { value: 'custom', labelKey: 'dailyTaskReport.filters.customRange' as const },
];

export const Filters = () => {
  const { filters, updateFilter, options } = useDailyTaskReport();
  const { t } = useAppTranslation();
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [timeDrawerOpen, setTimeDrawerOpen] = useState(false);
  const [picDrawerOpen, setPicDrawerOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [stepDrawerOpen, setStepDrawerOpen] = useState(false);
  const [subStepDrawerOpen, setSubStepDrawerOpen] = useState(false);

  const handleClear = () => {
    updateFilter('search', '');
    updateFilter('status', 'all');
    updateFilter('timePeriod', 'all');
    updateFilter('customStart', '');
    updateFilter('customEnd', '');
    updateFilter('pic', 'all');
    updateFilter('task', 'all');
    updateFilter('step', 'all');
    updateFilter('subStep', 'all');
  };

  const statusOpt = STATUS_OPTIONS.find((o) => o.value === filters.status);
  const statusLabel = statusOpt ? t(statusOpt.labelKey, 'All') : filters.status || t('dailyTaskReport.filters.all', 'All');

  const timeOpt = TIME_OPTIONS.find((o) => o.value === filters.timePeriod);
  const timeLabel = timeOpt ? t(timeOpt.labelKey, 'All Time') : filters.timePeriod || t('dailyTaskReport.filters.allTime', 'All Time');

  const picLabel = filters.pic === 'all' || !filters.pic
    ? t('dailyTaskReport.filters.allPic', 'All PIC')
    : filters.pic;
  const taskLabel = filters.task === 'all' || !filters.task
    ? t('dailyTaskReport.filters.allTasks', 'All Tasks')
    : filters.task;
  const stepLabel = filters.step === 'all' || !filters.step
    ? t('dailyTaskReport.filters.allSteps', 'All Steps')
    : filters.step;
  const subStepLabel = filters.subStep === 'all' || !filters.subStep
    ? t('dailyTaskReport.filters.allSubSteps', 'All Sub-steps')
    : filters.subStep;

  return (
    <div className="p-2 md:p-2 bg-card border border-border rounded-lg">
      <div className="flex flex-col gap-2">
        {/* Search + Refresh */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none" />
            <Input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder={t('dailyTaskReport.filters.searchPlaceholder', 'Search employee, task, step...')}
              className="w-full pl-10 pr-4 h-9 border border-input rounded-md text-sm bg-background"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 flex-shrink-0 border-input"
            onClick={handleClear}
            title={t('dailyTaskReport.filters.clearFilters', 'Clear filters')}
            aria-label={t('dailyTaskReport.filters.clearFilters', 'Clear filters')}
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Six filter drawers */}
        <div className="flex flex-wrap gap-1.5">
          {/* Status */}
          <Drawer open={statusDrawerOpen} onOpenChange={setStatusDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-input flex-1 min-w-[90px] justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{statusLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('dailyTaskReport.filters.status', 'Status')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        updateFilter('status', opt.value);
                        setStatusDrawerOpen(false);
                      }}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm border transition-colors',
                        filters.status === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {t(opt.labelKey, opt.value)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Time Period */}
          <Drawer open={timeDrawerOpen} onOpenChange={setTimeDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-input flex-1 min-w-[90px] justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{timeLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('dailyTaskReport.filters.timePeriod', 'Time Period')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        updateFilter('timePeriod', opt.value);
                        setTimeDrawerOpen(false);
                      }}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm border transition-colors',
                        filters.timePeriod === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {t(opt.labelKey, opt.value)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>

          {/* PIC */}
          <Drawer open={picDrawerOpen} onOpenChange={setPicDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-input flex-1 min-w-[90px] justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{picLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('dailyTaskReport.filters.pic', 'PIC')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto overflow-x-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      updateFilter('pic', 'all');
                      setPicDrawerOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors',
                      (filters.pic === 'all' || !filters.pic)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    )}
                  >
                    {t('dailyTaskReport.filters.allPic', 'All PIC')}
                  </button>
                  {(options.pics || []).map((n: string) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        updateFilter('pic', n);
                        setPicDrawerOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal',
                        filters.pic === n
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Task */}
          <Drawer open={taskDrawerOpen} onOpenChange={setTaskDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-input flex-1 min-w-[90px] justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{taskLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('dailyTaskReport.filters.task', 'Task')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto overflow-x-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      updateFilter('task', 'all');
                      updateFilter('step', 'all');
                      updateFilter('subStep', 'all');
                      setTaskDrawerOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors',
                      (filters.task === 'all' || !filters.task)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    )}
                  >
                    {t('dailyTaskReport.filters.allTasks', 'All Tasks')}
                  </button>
                  {(options.tasks || []).map((tName: string) => (
                    <button
                      key={tName}
                      type="button"
                      onClick={() => {
                        updateFilter('task', tName);
                        updateFilter('step', 'all');
                        updateFilter('subStep', 'all');
                        setTaskDrawerOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal',
                        filters.task === tName
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {tName}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Step */}
          <Drawer open={stepDrawerOpen} onOpenChange={setStepDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-input flex-1 min-w-[90px] justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{stepLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('dailyTaskReport.filters.step', 'Step')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto overflow-x-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      updateFilter('step', 'all');
                      updateFilter('subStep', 'all');
                      setStepDrawerOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors',
                      (filters.step === 'all' || !filters.step)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    )}
                  >
                    {t('dailyTaskReport.filters.allSteps', 'All Steps')}
                  </button>
                  {(options.steps || []).map((s: string) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        updateFilter('step', s);
                        updateFilter('subStep', 'all');
                        setStepDrawerOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal',
                        filters.step === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Sub-step */}
          <Drawer open={subStepDrawerOpen} onOpenChange={setSubStepDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs border-input flex-1 min-w-[90px] justify-between gap-1.5 text-left px-2"
              >
                <span className="truncate min-w-0">{subStepLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                <DrawerTitle className="text-lg font-semibold">
                  {t('dailyTaskReport.filters.subStep', 'Sub-step')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto overflow-x-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      updateFilter('subStep', 'all');
                      setSubStepDrawerOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors',
                      (filters.subStep === 'all' || !filters.subStep)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    )}
                  >
                    {t('dailyTaskReport.filters.allSubSteps', 'All Sub-steps')}
                  </button>
                  {(options.subSteps || []).map((s: string) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        updateFilter('subStep', s);
                        setSubStepDrawerOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal',
                        filters.subStep === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                <DrawerClose asChild>
                  <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Custom date range when timePeriod is custom */}
        {filters.timePeriod === 'custom' && (
          <div className="flex items-center gap-1 w-full">
            <Input
              type="date"
              value={filters.customStart || ''}
              onChange={(e) => updateFilter('customStart', e.target.value)}
              className="h-9 flex-1 text-sm"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={filters.customEnd || ''}
              onChange={(e) => updateFilter('customEnd', e.target.value)}
              className="h-9 flex-1 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
};
