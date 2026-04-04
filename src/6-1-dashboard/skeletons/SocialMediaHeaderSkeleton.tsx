import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

/** Matches HeaderAndTab: title, subtitle, 5× (icon + label), active tab border-primary, base line */
const HEADER_TAB_PLACEHOLDERS = [
  { id: 'dashboard', labelClass: 'w-[4.75rem]' },
  { id: 'content-calendar', labelClass: 'w-[7.25rem]' },
  { id: 'product-knowledge', labelClass: 'w-[7.25rem]' },
  { id: 'script-generator', labelClass: 'w-[7.75rem]' },
  { id: 'settings', labelClass: 'w-[3.5rem]' },
] as const;

export function SocialMediaHeaderSkeleton({
  activeTabId = 'dashboard',
  flushBottom,
}: {
  activeTabId?: string;
  /** Selaras dengan HeaderAndTab `flushBottom` (tanpa celah abu di bawah tab) */
  flushBottom?: boolean;
}) {
  return (
    <div className={cn('flex-shrink-0 px-1', flushBottom ? 'pt-3 pb-0' : 'mb-1 py-3')}>
      <span className="sr-only">Memuat Social Media Management</span>
      <div className="mb-3">
        <Skeleton className="mb-0.5 h-7 w-[min(100%,18rem)] max-w-full rounded-sm" />
        <Skeleton className="h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
      </div>

      <div className={flushBottom ? '' : '-mb-3'}>
        <nav
          className="flex flex-wrap gap-x-6 gap-y-1"
          aria-label="Memuat navigasi social media"
        >
          {HEADER_TAB_PLACEHOLDERS.map((tab) => {
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
                <Skeleton
                  className={cn(
                    'h-4 w-4 shrink-0 rounded-sm',
                    active && 'bg-primary/30',
                  )}
                />
                <Skeleton
                  className={cn('h-4 rounded-sm', tab.labelClass, active && 'bg-primary/25')}
                />
              </div>
            );
          })}
        </nav>
        <div className="mt-0.5 h-px w-full bg-primary/25" aria-hidden />
      </div>
    </div>
  );
}
