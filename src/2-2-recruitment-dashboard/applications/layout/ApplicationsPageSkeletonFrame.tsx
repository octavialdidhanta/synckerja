import type { ReactNode } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  RECRUITMENT_FULL_COLUMN,
  RECRUITMENT_MAIN_GRID,
  RECRUITMENT_TABLE_SECTION,
} from "../../layout/recruitmentIntervieweesLayout";

type Props = {
  children: ReactNode;
  ariaLabel?: string;
};

export function ApplicationsPageSkeletonFrame({ children, ariaLabel }: Props) {
  const { t } = useAppTranslation();
  const label = ariaLabel ?? t("recruitment.page.loadingAria", "Loading recruitment");

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={label}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <div className="px-1 py-3">
                    <div className="mb-3">
                      <Skeleton className="mb-0.5 h-7 w-44 max-w-[90%]" />
                      <Skeleton className="h-3 w-full max-w-xl" />
                    </div>
                    <div className="-mb-3">
                      <div className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
                        <Skeleton className="h-9 w-28" />
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-36" />
                        <Skeleton className="h-9 w-32" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={RECRUITMENT_MAIN_GRID}>
                  <div className={RECRUITMENT_FULL_COLUMN}>
                    <div className="mb-2 flex-shrink-0">
                      <div className="rounded-md border border-border bg-card p-2">
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                          <Skeleton className="h-9 min-w-[150px] flex-1" />
                          <Skeleton className="h-9 w-full sm:w-[130px]" />
                          <Skeleton className="h-9 w-full sm:w-[130px]" />
                          <Skeleton className="h-9 w-full shrink-0 sm:w-auto sm:min-w-[5.5rem]" />
                        </div>
                      </div>
                    </div>

                    <div className={RECRUITMENT_TABLE_SECTION}>
                      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        {children}
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-44 max-w-[55%]" />
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
    </div>
  );
}
