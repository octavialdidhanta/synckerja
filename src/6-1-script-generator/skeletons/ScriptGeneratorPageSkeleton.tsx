import { Skeleton } from '@/shared/components/ui/skeleton';
import { SocialMediaHeaderSkeletonSlot } from '@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  SCRIPT_GENERATOR_GRID_FORM_SHOWN,
  SCRIPT_GENERATOR_MAIN_GRID,
  SCRIPT_GENERATOR_TABLE_SECTION,
} from '../layout/scriptGeneratorLayout';

type ScriptGeneratorPageSkeletonMode = 'route' | 'overlay';

const ACCORDION_LABEL_WIDTHS = ['w-36', 'w-40', 'w-32', 'w-44'] as const;

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function FormPanelHeaderSkeleton() {
  return (
    <div className="flex shrink-0 items-center border-b border-gray-200 bg-gray-50 px-3 py-2">
      <div className="inline-flex items-center gap-2">
        <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
        <Skeleton className="h-4 w-[8.5rem] rounded-sm" />
      </div>
    </div>
  );
}

function FormColumnSkeleton() {
  return (
    <div className={SCRIPT_GENERATOR_TABLE_SECTION}>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <FormPanelHeaderSkeleton />
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-full min-w-0 p-4">
              <div className="space-y-2">
                {ACCORDION_LABEL_WIDTHS.map((labelW, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 px-3 py-2">
                    <Skeleton className={cn('mb-0 h-5 rounded-sm', labelW)} />
                    {i === 0 ? (
                      <div className="mt-2 space-y-2">
                        <Skeleton className="h-20 w-full rounded-lg" />
                        <Skeleton className="h-9 w-full rounded-md" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiddlePanelSkeleton() {
  return (
    <div className={SCRIPT_GENERATOR_TABLE_SECTION}>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-full min-w-0 p-4">
              <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6">
                <Skeleton className="h-4 w-[min(100%,20rem)] max-w-full rounded-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPanelSkeleton() {
  return (
    <div className={SCRIPT_GENERATOR_TABLE_SECTION}>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="w-full min-w-0 px-4 pb-4 pt-4">
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6">
              <Skeleton className="h-4 w-[min(100%,18rem)] max-w-full rounded-sm" />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-40 max-w-[55%]" />
            <Skeleton className="h-3 w-24 max-w-[40%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MainGridSkeleton() {
  return (
    <div className={cn(SCRIPT_GENERATOR_MAIN_GRID, SCRIPT_GENERATOR_GRID_FORM_SHOWN)}>
      <FormColumnSkeleton />
      <MiddlePanelSkeleton />
      <RightPanelSkeleton />
    </div>
  );
}

/**
 * Skeleton untuk `/digital-marketing/social-media/script-generator` (layout 3 kolom desktop).
 */
export function ScriptGeneratorPageSkeleton({
  mode = 'route',
  headerActiveTabId = 'script-generator',
}: {
  mode?: ScriptGeneratorPageSkeletonMode;
  headerActiveTabId?: string;
}) {
  const { t } = useAppTranslation();
  const aria = t('scriptGenerator.loadingAria', 'Loading script generator');
  const inner = (
    <>
      <SocialMediaHeaderSkeletonSlot activeTabId={headerActiveTabId} />
      <MainGridSkeleton />
    </>
  );

  if (mode === 'overlay') {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100" aria-busy aria-label={aria}>
        <span className="sr-only">{aria}</span>
        <div className={MAIN_SCROLL}>
          <div className="flex min-h-full flex-1 flex-col bg-muted/40">{inner}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className={MAIN_SCROLL}>
              <div className="flex min-h-full flex-1 flex-col bg-muted/40">{inner}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
