import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

/** Label default selaras `HeaderAndTab` (EN) — dipakai untuk ukuran invisible. */
const HEADER_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'content-calendar', label: 'Content Calendar' },
  { id: 'product-knowledge', label: 'Creative' },
  { id: 'script-generator', label: 'Customer Persona' },
  { id: 'settings', label: 'Settings' },
] as const;

const HEADER_TITLE = 'Social Media Management';
const HEADER_SUBTITLE = 'Manage social media content and calendar';

/**
 * Mirror isi `HeaderAndTab` (`px-1` + `py-3` / `flushBottom`) — tanpa `mb-1` / `flex-shrink-0` di root.
 * Pakai `SocialMediaHeaderSkeletonSlot` di halaman agar wrapper `mb-1 flex-shrink-0` sama dengan live.
 */
export function SocialMediaHeaderSkeleton({
  activeTabId = 'dashboard',
  flushBottom,
}: {
  activeTabId?: string;
  flushBottom?: boolean;
}) {
  return (
    <div className={cn('px-1', flushBottom ? 'pt-3 pb-0' : 'py-3')}>
      <span className="sr-only">Memuat Social Media Management</span>

      <div className="mb-3">
        <div className="relative mb-0.5 w-fit max-w-full">
          <h1 className="invisible whitespace-nowrap text-xl font-bold text-gray-900" aria-hidden>
            {HEADER_TITLE}
          </h1>
          <Skeleton className="absolute inset-0 rounded-sm" />
        </div>
        <div className="relative w-fit max-w-full">
          <p className="invisible whitespace-nowrap text-xs text-gray-600" aria-hidden>
            {HEADER_SUBTITLE}
          </p>
          <Skeleton className="absolute inset-0 rounded-sm" />
        </div>
      </div>

      <div className={flushBottom ? '' : '-mb-3'}>
        <nav className="flex space-x-6" aria-label="Memuat navigasi social media">
          {HEADER_TABS.map((tab) => {
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={cn(
                  'flex items-center space-x-1.5 border-b-2 py-1.5 px-1 font-medium text-sm',
                  active ? 'border-primary' : 'border-transparent',
                )}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Skeleton
                  className={cn('h-4 w-4 shrink-0 rounded-sm', active && 'bg-primary/30')}
                />
                <span className="relative inline-flex">
                  <span className="invisible whitespace-nowrap font-medium text-sm" aria-hidden>
                    {tab.label}
                  </span>
                  <Skeleton
                    className={cn(
                      'absolute inset-0 rounded-sm',
                      active && 'bg-primary/25',
                    )}
                  />
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** Mirror pembungkus halaman live: `<div className="mb-1 flex-shrink-0">` kecuali `flushBottom`. */
export function SocialMediaHeaderSkeletonSlot({
  activeTabId = 'dashboard',
  flushBottom,
}: {
  activeTabId?: string;
  flushBottom?: boolean;
}) {
  return (
    <div className={cn('flex-shrink-0', !flushBottom && 'mb-1')}>
      <SocialMediaHeaderSkeleton activeTabId={activeTabId} flushBottom={flushBottom} />
    </div>
  );
}
