import type { ReactNode } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CustomersHeaderAndTab } from "./CustomersHeaderAndTab";
import { CUSTOMERS_MAIN_GRID, CUSTOMERS_TABLE_SECTION } from "./customersLayout";

type Props = {
  children: ReactNode;
  ariaLabel?: string;
};

export function CustomersPageSkeletonFrame({ children, ariaLabel }: Props) {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={ariaLabel}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 flex-shrink-0">
                <CustomersHeaderAndTab />
              </div>
              <div className={CUSTOMERS_MAIN_GRID}>
                <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                  <div className={CUSTOMERS_TABLE_SECTION}>
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      {children}
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-40 max-w-[55%]" />
                          <Skeleton className="h-3 w-24 max-w-[40%]" />
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
