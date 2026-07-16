import { Skeleton } from "@/shared/components/ui/skeleton";

/** Fase loading tabel report — tanpa header (shell sudah punya header). */
export function SocialMediaInsightReportTablePhaseSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-0.5 h-3 w-full max-w-xl" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Skeleton className="h-9 w-[11rem]" />
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-white px-3 py-2">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="space-y-0 p-0">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="mx-3 my-3 h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
