import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type Mode = 'route' | 'overlay';

/** Mirror `HeaderAndTab`: px-1 py-3, text-xl title, tabs space-x-6 (tanpa garis ekstra di bawah nav). */
function SettingsHeaderSkeleton({ activeTabId = 'settings' }: { activeTabId?: string }) {
  const tabs = [
    { id: 'dashboard', labelW: 'w-[4.75rem]' },
    { id: 'content-calendar', labelW: 'w-[7.25rem]' },
    { id: 'product-knowledge', labelW: 'w-[7.25rem]' },
    { id: 'script-generator', labelW: 'w-[7.75rem]' },
    { id: 'settings', labelW: 'w-[3.5rem]' },
  ] as const;

  return (
    <div className="mb-1 flex-shrink-0">
      <span className="sr-only">Memuat Social Media Management</span>
      <div className="px-1 py-3">
        <div className="mb-3">
          <Skeleton className="mb-0.5 h-6 w-[min(100%,16rem)] max-w-full rounded-sm" />
          <Skeleton className="h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
        </div>
        <div className="-mb-3">
          <nav className="flex space-x-6" aria-label="Memuat navigasi social media">
            {tabs.map((tab) => {
              const active = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className={cn(
                    'flex items-center space-x-1.5 border-b-2 py-1.5 px-1',
                    active ? 'border-primary' : 'border-transparent',
                  )}
                  style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                >
                  <Skeleton className={cn('h-4 w-4 shrink-0 rounded-sm', active && 'bg-primary/30')} />
                  <Skeleton className={cn('h-4 rounded-sm', tab.labelW, active && 'bg-primary/25')} />
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

/** Mirror `SettingsSidebar`: kartu p-3 + ikon + judul + badge + deskripsi; blok real-time di bawah. */
function SettingsSidebarSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-full rounded-[5px] border border-border bg-card p-3 text-left"
        >
          <div className="flex items-start space-x-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-[5px]" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-[min(100%,11rem)] max-w-full rounded-sm" />
                <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full max-w-[13rem] rounded-sm" />
              <Skeleton className="mt-1 h-3 w-[min(100%,10rem)] rounded-sm" />
            </div>
          </div>
        </div>
      ))}
      <div className="mt-4 rounded-[5px] border border-primary/30 bg-primary/10 p-3">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-primary/40" aria-hidden />
          <Skeleton className="h-3 w-28 rounded-sm" />
        </div>
        <Skeleton className="mt-2 h-3 w-[min(100%,15rem)] max-w-full rounded-sm" />
      </div>
    </div>
  );
}

/** Mirror panel utama: header seperti Approval Access + tombol; isi seperti tabel; footer. */
function SettingsMainPanelSkeleton() {
  return (
    <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden md:col-span-9 lg:h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm lg:h-full">
          <div className="flex-shrink-0 border-b border-border bg-primary/5 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-[10.5rem] max-w-full rounded-sm" />
                <Skeleton className="mt-1 h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
              </div>
              <Skeleton className="h-9 w-[11.5rem] shrink-0 rounded-[5px]" />
            </div>
          </div>

          <div className={cn(
            'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}>
            <div className="p-4">
              <div className="overflow-x-auto">
              <div className="min-w-[28rem] overflow-hidden rounded-md border border-border bg-card sm:min-w-[36rem]">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-3.5 w-[min(100%,6rem)] rounded-sm" />
                  ))}
                </div>
                {Array.from({ length: 6 }).map((_, row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 border-b border-border px-3 py-3 last:border-b-0"
                  >
                    <Skeleton className="h-4 w-full max-w-[8rem] rounded-sm" />
                    <Skeleton className="h-4 w-full rounded-sm" />
                    <Skeleton className="h-4 w-full max-w-[10rem] rounded-sm" />
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
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

/** Isi scroll: sama urutannya dengan `SettingsPage` (header → grid → spacer). */
function SettingsSkeletonInner({ headerActiveTabId }: { headerActiveTabId: string }) {
  return (
    <>
      <SettingsHeaderSkeleton activeTabId={headerActiveTabId} />
      <SettingsGridSkeleton />
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </>
  );
}

/**
 * Shell scroll identik dengan halaman live (`SettingsPage`), supaya tidak ada lompakan layout guard/chunk/data.
 */
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
