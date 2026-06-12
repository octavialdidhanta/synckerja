import { SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SubscriptionExpiryBannerSlot } from '@/10-subscription/shared/SubscriptionExpiryBannerSlot';

export type ToolsMobileShellHeaderVariant =
  | 'dailyTask'
  | 'initiative'
  | 'jobdesc'
  | 'summary'
  | 'dailyTaskReport'
  | 'meetingNotes';

type ToolsMobileShellHeaderProps = {
  variant: ToolsMobileShellHeaderVariant;
};

const HEADER_COPY: Record<
  ToolsMobileShellHeaderVariant,
  { titleKey: string; titleDefault: string; subtitleKey: string; subtitleDefault: string }
> = {
  dailyTask: {
    titleKey: 'dailyTask.page.title',
    titleDefault: 'Daily Task',
    subtitleKey: 'dailyTask.page.subtitle',
    subtitleDefault: 'Manage your daily tasks here',
  },
  initiative: {
    titleKey: 'initiative.page.title',
    titleDefault: 'Initiative',
    subtitleKey: 'initiative.page.subtitle',
    subtitleDefault: 'Track initiative progress',
  },
  jobdesc: {
    titleKey: 'jobDesc.page.title',
    titleDefault: 'Job Desc',
    subtitleKey: 'jobDesc.page.subtitle',
    subtitleDefault: 'See active workload per employee',
  },
  summary: {
    titleKey: 'dailyTask.sidebar.summaryTab',
    titleDefault: 'Task Summary',
    subtitleKey: 'dailyTask.sidebar.summaryDescription',
    subtitleDefault: 'Overview of daily tasks',
  },
  dailyTaskReport: {
    titleKey: 'dailyTaskReport.page.title',
    titleDefault: 'Daily Task Report',
    subtitleKey: 'dailyTaskReport.page.subtitle',
    subtitleDefault: 'Ringkasan performa dan progress tugas',
  },
  meetingNotes: {
    titleKey: 'meetingNotes.page.title',
    titleDefault: 'Meeting Notes',
    subtitleKey: 'meetingNotes.page.subtitle',
    subtitleDefault: 'Catat dan tindak lanjuti poin rapat',
  },
};

/** Title-only header when tools page access is denied (actions live in routed content when allowed). */
export function ToolsMobileShellHeader({ variant }: ToolsMobileShellHeaderProps) {
  const { t } = useAppTranslation();
  const copy = HEADER_COPY[variant];

  return (
    <>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground">
              {t(copy.titleKey, copy.titleDefault)}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t(copy.subtitleKey, copy.subtitleDefault)}
            </p>
          </div>
        </div>
        <div className="w-9 shrink-0" aria-hidden />
      </header>
      <SubscriptionExpiryBannerSlot />
    </>
  );
}
