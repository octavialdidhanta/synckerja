import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { MobileIncomesViewportChromeSkeleton } from "@/mobile/3-dashboard/pages/MobileIncomesViewportChromeSkeleton";

function MobileBankAccountCardSkeleton() {
  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border bg-card">
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
        <div className="flex flex-shrink-0 items-center justify-between border-b bg-muted/50 px-3 py-2">
          <Skeleton className="h-4 w-36 max-w-[55%]" aria-hidden />
          <Skeleton className="h-8 w-32 shrink-0 rounded-md" aria-hidden />
        </div>
        <div className="flex min-h-0 flex-1 flex-col space-y-2 px-3 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full shrink-0 rounded-lg" aria-hidden />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type MobileBankAccountBodySkeletonProps = {
  className?: string;
};

export function MobileBankAccountBodySkeleton({ className }: MobileBankAccountBodySkeletonProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <MobileBankAccountCardSkeleton />
    </div>
  );
}

export function MobileBankAccountChromeSkeleton({ wrapperClassName }: { wrapperClassName?: string }) {
  const { t } = useAppTranslation();
  const aria = t("incomes.bankAccountsPage.loadingAria", "Loading bank accounts");
  return (
    <MobileIncomesViewportChromeSkeleton wrapperClassName={wrapperClassName} ariaLabel={aria}>
      <MobileBankAccountBodySkeleton className="mx-auto w-full max-w-md flex-1 content-padding-above-nav-default px-2 pt-2" />
    </MobileIncomesViewportChromeSkeleton>
  );
}

export function MobileBankAccountFullViewportOverlay() {
  return (
    <MobileBankAccountChromeSkeleton wrapperClassName="fixed inset-0 z-[200] min-h-[100dvh] bg-background" />
  );
}

export function MobileBankAccountShellSkeleton() {
  return (
    <div className="relative min-h-[100dvh] min-w-0 w-full bg-background">
      <MobileBankAccountChromeSkeleton />
    </div>
  );
}
