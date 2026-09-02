import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { XenditHeaderAndTab } from "@/4-1-transaction/xendit/components/XenditHeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import {
  XenditBalanceTabSkeleton,
} from "@/4-1-transaction/xendit/skeletons/XenditBalancePageSkeleton";
import {
  XenditConnectTabSkeleton,
  XenditHistoryTabContentSkeleton,
} from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import {
  XENDIT_BALANCE_PATH,
  XENDIT_BASE_PATH,
  XENDIT_HISTORY_PATH,
} from "@/xendit/lib/xenditPaths";

type IncomeXenditModuleShellProps = {
  children: ReactNode;
  showContent?: boolean;
};

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function resolveXenditSkeletonVariant(pathname: string): "connect" | "balance" | "history" {
  if (pathname.startsWith(XENDIT_HISTORY_PATH)) return "history";
  if (pathname.startsWith(XENDIT_BALANCE_PATH)) return "balance";
  return "connect";
}

function XenditTabOverlaySkeleton({ variant }: { variant: "connect" | "balance" | "history" }) {
  if (variant === "balance") return <XenditBalanceTabSkeleton />;
  if (variant === "history") return <XenditHistoryTabContentSkeleton />;
  return <XenditConnectTabSkeleton />;
}

export function IncomeXenditModuleShell({
  children,
  showContent = true,
}: IncomeXenditModuleShellProps) {
  const { pathname } = useLocation();
  const skeletonVariant = resolveXenditSkeletonVariant(pathname);
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 flex-col",
          !showContent && "pointer-events-none invisible select-none",
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className={cn(MAIN_SCROLL, "min-w-0")}>
              <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                <div className="mb-1 min-w-0 flex-shrink-0">
                  <XenditHeaderAndTab />
                </div>

                <ModuleShellContentGate pagePath={XENDIT_BASE_PATH}>
                  {children}
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
        >
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
            <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
              <div className={cn(MAIN_SCROLL, "min-w-0")}>
                <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                  <div className="mb-1 min-w-0 flex-shrink-0">
                    <XenditHeaderAndTab />
                  </div>
                  <XenditTabOverlaySkeleton variant={skeletonVariant} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
