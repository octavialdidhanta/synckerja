import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import TaskSummaryCards from '@/8-2-DailyTask/section/TaskSummaryCards';
import { useNotificationBadgeCount } from '@/shared/hooks/useNotificationBadgeCount';
import { NotificationsModal } from '@/mobile-app/components/NotificationsModal';

/**
 * Mobile full-screen Task Summary (`view=summary`).
 * Header selaras tab Daily Task utama: judul modul + subtitle (bukan salam/nama).
 */
export function DailyTaskSummaryView() {
  const { t } = useAppTranslation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { totalCount: notificationBadgeCount } = useNotificationBadgeCount();

  return (
    <>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="shrink-0 md:hidden" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight text-foreground">
              {t('dailyTask.sidebar.summaryTab', 'Task Summary')}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t('dailyTask.sidebar.summaryDescription', 'Overview of daily tasks')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label={t('mobileHome.notificationsTitle', 'Notifikasi')}
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {notificationBadgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} initialTab="tasks" />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="content-padding-above-nav-daily-task mx-auto w-full max-w-md space-y-1 px-2 pt-2">
            <TaskSummaryCards />
          </div>
        </div>
      </div>
    </>
  );
}
