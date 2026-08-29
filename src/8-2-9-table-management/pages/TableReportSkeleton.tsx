/** Layout-matched skeleton for Table Report. */
export function TableReportSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-100 px-4 pb-2" aria-busy>
      <div className="mb-2 h-10 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mb-3 flex gap-2">
        <div className="h-9 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-36 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-36 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mb-3 flex gap-6">
        <div className="h-14 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-14 w-28 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="min-h-[320px] flex-1 animate-pulse rounded-lg bg-slate-200/80" />
    </div>
  );
}
