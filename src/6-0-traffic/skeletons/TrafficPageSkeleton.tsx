import React from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { HeaderAndTab } from "../container/HeaderAndTab";

/**
 * Layout-matched skeleton for `/digital-marketing/traffic`
 * Used by PageAccessGuard loadingShell and Suspense fallback.
 */
export function TrafficPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="shrink-0 border-b border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-6 w-44" />
                        <Skeleton className="h-9 w-28" />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </div>
                    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-12 lg:col-span-4">
                          <Skeleton className="h-28 w-full rounded-lg" />
                        </div>
                        <div className="col-span-12 lg:col-span-4">
                          <Skeleton className="h-28 w-full rounded-lg" />
                        </div>
                        <div className="col-span-12 lg:col-span-4">
                          <Skeleton className="h-28 w-full rounded-lg" />
                        </div>
                        <div className="col-span-12">
                          <Skeleton className="h-40 w-full rounded-lg" />
                        </div>
                        <div className="col-span-12">
                          <Skeleton className="h-[480px] w-full rounded-lg [@media(max-height:900px)]:h-[420px] [@media(max-height:760px)]:h-[380px]" />
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

