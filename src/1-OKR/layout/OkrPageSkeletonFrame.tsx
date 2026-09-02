import type { ReactNode } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { OkrHeaderAndTabSkeleton } from "../components/OkrHeaderAndTabSkeleton";
import { OKR_MAIN_GRID, OKR_TABLE_SECTION } from "./okrLayout";

type Props = {
  children: ReactNode;
  sidebarBody?: ReactNode;
  ariaLabel?: string;
};

function DefaultSidebarBody() {
  return (
    <div className="h-full min-h-0 space-y-4 p-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-20 w-full rounded-md" />
    </div>
  );
}

export function OkrPageSkeletonFrame({ children, sidebarBody, ariaLabel }: Props) {
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gray-100 font-sans dark:bg-muted/30"
      aria-busy
      aria-label={ariaLabel}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : <span className="sr-only">Loading</span>}
      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <OkrHeaderAndTabSkeleton />
                </div>

                <div className={OKR_MAIN_GRID}>
                  <div className="col-span-9 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch overflow-hidden">
                    <div className={OKR_TABLE_SECTION}>
                      <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border border-border">
                        <CardContent className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-0 sm:p-6">
                          {children}
                        </CardContent>
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-52 max-w-[55%]" />
                            <Skeleton className="h-3 w-24 max-w-[40%]" />
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch">
                    <div className={OKR_TABLE_SECTION}>
                      <div className="flex h-full min-h-0 w-full min-w-0 flex-col self-stretch rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="mt-1 h-3 w-full max-w-[200px]" />
                        </div>
                        <div className="min-h-0 flex-1">{sidebarBody ?? <DefaultSidebarBody />}</div>
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-14" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
