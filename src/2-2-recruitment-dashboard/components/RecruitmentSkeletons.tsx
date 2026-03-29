import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

function useRecruitmentLoadingAria() {
  const { t } = useAppTranslation();
  return t("recruitment.page.loadingAria", "Loading recruitment");
}

/** Lazy-route / Suspense fallback: generic header strip + main card (matches shell content area). */
export function RecruitmentRouteSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/30 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="mb-1 flex-shrink-0 px-1 py-3">
          <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
          <Skeleton className="mb-4 h-3 w-full max-w-xl" />
          <div className="flex flex-wrap gap-4 border-b border-border pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </div>
        <Skeleton className="min-h-[min(70vh,520px)] w-full flex-1 rounded-lg border border-border bg-card" />
      </div>
    </div>
  );
}

export function RecruitmentDashboardSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/30 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
        <div className="mb-1 flex-shrink-0 px-1 py-3">
          <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
          <Skeleton className="mb-4 h-3 w-full max-w-xl" />
          <div className="flex flex-wrap gap-4 border-b border-border pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-brand-blue/20 bg-brand-blue/10 p-4">
                <Skeleton className="mb-2 h-9 w-16 bg-background/50" />
                <Skeleton className="h-4 w-24 bg-background/50" />
              </div>
            ))}
          </div>
          <Skeleton className="mb-4 h-5 w-48" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecruitmentJobOpeningsSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/30 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
        <div className="mb-1 flex-shrink-0 px-1 py-3">
          <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
          <Skeleton className="mb-4 h-3 w-full max-w-xl" />
          <div className="flex flex-wrap gap-4 border-b border-border pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
          <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col">
            <div className="mb-2 flex-shrink-0 rounded-md border border-border bg-card p-2">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-full max-w-[200px]" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
            <div className="mb-2 grid flex-shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-md border border-border bg-card p-4">
                  <Skeleton className="mb-3 h-4 w-24" />
                  <Skeleton className="mb-1 h-8 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
              <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
              <div className="flex-shrink-0 border-t border-border px-4 py-2">
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
          <div className="col-span-3 flex h-full min-h-0 flex-col">
            <div className="flex max-h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-card shadow-sm">
              <div className="flex-shrink-0 border-b px-4 py-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-full max-w-[180px]" />
                  </div>
                  <Skeleton className="h-8 w-20 shrink-0" />
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 p-4">
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
              <div className="flex-shrink-0 border-t px-4 py-2">
                <Skeleton className="h-3 w-full max-w-[200px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecruitmentApplicationsSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/30 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
        <div className="mb-1 flex-shrink-0 px-1 py-3">
          <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
          <Skeleton className="mb-4 h-3 w-full max-w-xl" />
          <div className="flex flex-wrap gap-4 border-b border-border pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-full max-w-xs" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecruitmentIntervieweesSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/30 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
        <div className="mb-1 flex-shrink-0 px-1 py-3">
          <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
          <Skeleton className="mb-4 h-3 w-full max-w-xl" />
          <div className="flex flex-wrap gap-4 border-b border-border pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-full sm:w-[130px]" />
            <Skeleton className="h-9 w-full sm:w-[130px]" />
            <Skeleton className="h-9 w-full sm:w-[130px]" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
