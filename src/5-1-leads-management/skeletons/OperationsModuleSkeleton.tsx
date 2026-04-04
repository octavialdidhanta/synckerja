import { LoadingDots } from "@/shared/components/LoadingDots";

export function OperationsModuleSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-surface-muted py-16"
      aria-busy
      aria-label="Loading"
    >
      <LoadingDots />
    </div>
  );
}
