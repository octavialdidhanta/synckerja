import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card } from "@/mobile-app/components/ui/card";

function SecurityContentSkeleton() {
  return (
    <div className="space-y-1">
      <Card className="border border-border bg-gradient-card">
        <div className="space-y-3 border-b border-border p-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-full max-w-xs" />
        </div>
        <div className="space-y-3 p-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </Card>
      <Card className="border border-border bg-gradient-card p-3">
        <Skeleton className="mb-2 h-4 w-44" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="mt-2 h-9 w-32" />
      </Card>
      <Card className="border border-border bg-gradient-card p-3">
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="mt-2 h-3 max-w-[80%]" />
      </Card>
    </div>
  );
}

type Props = {
  /** `full` — shell + content; `content` — cards only (inside shell outlet) */
  variant?: "full" | "content";
};

export function MobileSecuritySettingsSkeleton({ variant = "full" }: Props) {
  if (variant === "content") {
    return <SecurityContentSkeleton />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background" aria-busy>
      <header className="sticky top-0 z-30 flex flex-shrink-0 items-center gap-2 border-b border-border bg-card p-3 safe-area-top">
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="content-padding-above-nav-default mx-auto w-full max-w-md space-y-1 px-2 pt-2">
            <SecurityContentSkeleton />
          </div>
        </div>
      </div>
      <Skeleton className="h-14 w-full shrink-0" />
    </div>
  );
}
