import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

const scrollHide =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function CreatePlanPageShell({
  children,
  scrollClassName,
}: {
  children: ReactNode;
  scrollClassName?: string;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[hsl(var(--brand-white))] safe-area-top">
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col px-5 py-8 sm:px-10 lg:py-10",
          "overflow-x-hidden overflow-y-auto seamless-scroll nested-scroll-touch-chain",
          scrollHide,
          scrollClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
