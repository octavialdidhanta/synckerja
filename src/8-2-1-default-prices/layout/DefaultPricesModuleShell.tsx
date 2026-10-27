import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { DefaultPricesHeaderAndTab } from "./DefaultPricesHeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { DefaultPricesPageSkeleton } from "../skeletons/DefaultPricesPageSkeleton";

type DefaultPricesModuleShellProps = {
  children: ReactNode;
  showContent: boolean;
};

export function DefaultPricesModuleShell({
  children,
  showContent,
}: DefaultPricesModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden",
          !showContent && "pointer-events-none invisible select-none",
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-muted/40">
            <div className="mb-1 flex-shrink-0">
              <DefaultPricesHeaderAndTab />
            </div>

            <ModuleShellContentGate className="min-h-0 flex-1 overflow-hidden">
              {children}
            </ModuleShellContentGate>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-auto bg-gray-100"
          aria-busy
        >
          <DefaultPricesPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
