import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { OMNICHANNEL_SETTINGS_CARD_HEADER_BASE } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";

/** Mirrors CRM `HeaderAndTab` (title + tab row) — shared with `OmnichannelSettingsPage` loading phase. */
function CrmHeaderTabSkeleton() {
  return (
    <div className="min-w-0 max-w-full px-1 py-3">
      <div className="mb-3 min-w-0 space-y-2">
        <Skeleton className="h-7 w-[min(100%,12rem)] max-w-full rounded-md" />
        <Skeleton className="h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
      </div>
      <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
        <nav className="flex min-w-0 flex-nowrap gap-x-6" aria-hidden>
          <div className="flex cursor-default items-center space-x-1.5 border-b-2 border-transparent py-1.5 px-1">
            <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
            <Skeleton className="h-4 w-28 shrink-0 rounded-sm" />
          </div>
        </nav>
      </div>
    </div>
  );
}

function TwoColumnSettingsSkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
      <div className="col-span-12 flex min-h-0 min-w-0 md:col-span-3">
        <div className="flex min-h-[280px] w-full flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm md:min-h-0">
          <div
            className={cn(OMNICHANNEL_SETTINGS_CARD_HEADER_BASE, "flex flex-col justify-center")}
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-52" />
          </div>
          <div className="flex-1 space-y-2 p-3">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
          <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
      <div className="col-span-12 flex min-h-0 min-w-0 md:col-span-9">
        <div className="flex min-h-[360px] w-full flex-1 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm md:min-h-0">
          <div
            className={cn(OMNICHANNEL_SETTINGS_CARD_HEADER_BASE, "flex items-start justify-between gap-3")}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-full max-w-xl" />
            </div>
            <Skeleton className="h-8 w-36 shrink-0 self-center rounded-md" />
          </div>
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 flex-1 max-w-sm rounded-md" />
              </div>
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
            <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
              <Skeleton className="h-3 w-full max-w-[min(100%,28rem)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Layout mirror for `OmnichannelSettingsPage` — shared by `PageAccessGuard` and `Suspense` fallback. */
export function OmnichannelSettingsPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("omnichannel.settings.loadingAria", "Loading omnichannel settings");
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-2 pb-2 sm:px-4">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="relative flex min-h-full w-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <CrmHeaderTabSkeleton />
              </div>
              <TwoColumnSettingsSkeleton />
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
