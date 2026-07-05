import { Skeleton } from "@/shared/components/ui/skeleton";

export function AutomationFlowEditorSkeleton() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-8 w-64" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-0">
        <div className="col-span-8 min-h-0 border-r border-border p-4">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
        <div className="col-span-4 space-y-3 p-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
