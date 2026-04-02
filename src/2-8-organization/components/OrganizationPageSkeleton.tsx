import { CompanyModuleShell } from "@/2-8-dashboard/layout/CompanyModuleShell";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type Props = { className?: string };

/**
 * Single page-level skeleton for /company/organization — matches CompanyModuleShell + main row layout.
 * Visible text for loading only for screen readers (Loading Skeleton rule).
 */
export function OrganizationPageSkeleton({ className }: Props) {
  const { t } = useAppTranslation();
  const label = t("organization.page.loadingAria", "Loading organizational structure");

  return (
    <div
      className={cn(
        "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-3 rounded-lg border border-border bg-card p-4 shadow-sm lg:gap-4 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]",
        className
      )}
      aria-busy
      aria-label={label}
    >
      <span className="sr-only">{label}</span>

      {/* Diagram column — mirrors OrganizationalDiagram (single surface, no nested card) */}
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden lg:col-span-9">
        <div className="flex min-h-0 flex-1 flex-col rounded-md bg-muted/40 p-3 sm:p-4">
          <div className="mb-6 flex flex-col items-center gap-3">
            {/* Company bar — darker than employee node placeholders */}
            <Skeleton className="h-14 w-full max-w-md rounded-xl bg-slate-800/85 dark:bg-slate-800/90" />
            <Skeleton className="h-8 w-0.5 shrink-0 bg-border" />
            {/* Employee node: avatar + text — distinct from org bar */}
            <div className="flex w-full max-w-[220px] flex-col items-center gap-3 rounded-lg border border-border bg-muted/50 p-4 shadow-sm">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full ring-2 ring-border" />
              <div className="flex w-full flex-col items-center gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-3 w-full max-w-[180px]" />
              </div>
            </div>
          </div>
          <Skeleton className="min-h-[120px] w-full flex-1 rounded-lg" />
          <div className="mt-4 flex justify-center gap-3">
            <Skeleton className="h-24 w-40 rounded-lg bg-teal-950/20" />
            <Skeleton className="h-24 w-40 rounded-lg bg-sky-950/20" />
          </div>
        </div>
      </div>

      {/* Sidebar — search/tools + stat cards */}
      <aside className="col-span-12 flex w-full min-w-0 shrink-0 flex-col gap-3 border-border lg:col-span-3 lg:border-l lg:pl-4">
        <div className="space-y-3 border-b border-border pb-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-14 w-full rounded-md" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-12 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}

/** `PageAccessGuard` `loadingShell` for `/company/organization` — mirrors live `CompanyModuleShell` + grid skeleton. */
export function OrganizationGuardLoadingShell() {
  return (
    <CompanyModuleShell>
      <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <OrganizationPageSkeleton className="min-h-0 flex-1" />
        </div>
      </div>
    </CompanyModuleShell>
  );
}
