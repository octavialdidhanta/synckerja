import { Skeleton } from '@/shared/components/ui/skeleton';
import { SocialMediaHeaderSkeletonSlot } from '@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton';
import { cn } from '@/shared/lib/utils';

type Mode = 'route' | 'overlay';

/** Mirror `SettingsSidebar`: kartu p-3 + ikon + judul + badge; blok real-time di bawah. */
function SettingsSidebarSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-full rounded-[5px] p-3 text-left',
            i === 0
              ? 'border-2 border-primary/50 bg-accent shadow-sm'
              : 'border border-border bg-card',
          )}
        >
          <div className="flex items-start space-x-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-[5px]" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-[min(100%,11rem)] max-w-full rounded-sm" />
                <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full max-w-[13rem] rounded-sm" />
            </div>
          </div>
        </div>
      ))}
      <div className="mt-4 rounded-[5px] border border-primary/30 bg-primary/10 p-3">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-primary/40" aria-hidden />
          <Skeleton className="h-3 w-28 rounded-sm" />
        </div>
        <Skeleton className="mt-1 h-3 w-[min(100%,15rem)] max-w-full rounded-sm" />
      </div>
    </div>
  );
}

/** Mirror `ApprovalAccessSection` + `ApprovalAccessTable` (border rounded-lg + Table). */
function SettingsMainPanelSkeleton() {
  return (
    <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden md:col-span-9 lg:h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm lg:h-full">
          <div className="flex-shrink-0 border-b border-border bg-primary/5 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-[10.5rem] max-w-full rounded-sm" />
                <Skeleton className="mt-1 h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
              </div>
              <Skeleton className="ml-4 h-9 w-[11.5rem] shrink-0 rounded-[5px]" />
            </div>
          </div>

          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="p-4">
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_5.5rem] gap-0 border-b border-border bg-muted/30 px-4 py-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-3.5 w-[min(100%,5.5rem)] rounded-sm" />
                  ))}
                </div>
                {Array.from({ length: 5 }).map((_, row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_5.5rem] items-center gap-0 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-full max-w-[8rem] rounded-sm" />
                      <Skeleton className="h-3 w-20 rounded-sm" />
                    </div>
                    <div className="flex gap-1">
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-16 rounded-sm" />
                    <Skeleton className="h-5 w-10 rounded-sm" />
                    <div className="flex justify-end gap-2 pr-2">
                      <Skeleton className="h-9 w-9 rounded-md" />
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-44 max-w-[50%] rounded-sm" />
              <Skeleton className="h-3 w-28 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSidebarColumnSkeleton() {
  return (
    <div className="col-span-12 flex min-h-0 flex-col overflow-hidden md:col-span-3 lg:h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm lg:h-full">
        <div className="flex-shrink-0 border-b border-border bg-primary/5 px-4 py-1.5">
          <Skeleton className="h-4 w-[12.5rem] max-w-full rounded-sm" />
          <Skeleton className="mt-1 h-3 w-[min(100%,14rem)] max-w-full rounded-sm" />
        </div>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SettingsSidebarSkeleton />
        </div>
        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-28 rounded-sm" />
            <Skeleton className="h-3 w-16 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsGridSkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
      <SettingsSidebarColumnSkeleton />
      <SettingsMainPanelSkeleton />
    </div>
  );
}

function SettingsSkeletonInner({ headerActiveTabId }: { headerActiveTabId: string }) {
  return (
    <>
      <SocialMediaHeaderSkeletonSlot activeTabId={headerActiveTabId} />
      <SettingsGridSkeleton />
    </>
  );
}

function SettingsSkeletonScrollShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
      <div className="flex h-full min-h-0 flex-col">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="relative flex min-h-full flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton `/digital-marketing/social-media/settings` — mirror layout & section (header, sidebar kartu, panel tabel, footer).
 */
export function SocialMediaSettingsPageSkeleton({
  mode = 'route',
  headerActiveTabId = 'settings',
}: {
  mode?: Mode;
  headerActiveTabId?: string;
}) {
  const inner = <SettingsSkeletonInner headerActiveTabId={headerActiveTabId} />;

  if (mode === 'overlay') {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-muted/40 font-sans">
        <div className="flex min-h-0 flex-1 flex-col">
          <SettingsSkeletonScrollShell>{inner}</SettingsSkeletonScrollShell>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-muted/40 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <SettingsSkeletonScrollShell>{inner}</SettingsSkeletonScrollShell>
      </div>
    </div>
  );
}
