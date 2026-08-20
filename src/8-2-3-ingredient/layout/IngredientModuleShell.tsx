import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { IngredientHeaderAndTab } from "./IngredientHeaderAndTab";
import { IngredientPageSkeleton } from "../skeletons/IngredientPageSkeleton";

type IngredientModuleShellProps = {
  children: ReactNode;
  showContent: boolean;
};

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function IngredientModuleShell({ children, showContent }: IngredientModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col",
          !showContent && "pointer-events-none invisible select-none",
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className={cn(MAIN_SCROLL, "min-w-0")}>
              <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                <div className="mb-1 min-w-0 shrink-0">
                  <IngredientHeaderAndTab />
                </div>
                <ModuleShellContentGate>{children}</ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-auto bg-gray-100"
          aria-busy
        >
          <IngredientPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
