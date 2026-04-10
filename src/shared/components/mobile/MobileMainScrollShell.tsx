import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

const scrollHide =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export type MobileMainScrollShellProps = {
  children: ReactNode;
  className?: string;
  /** Area scroll utama (konten). */
  contentClassName?: string;
};

/**
 * Shell layar penuh untuk modul mobile scroll panjang: brand background + scrollbar tersembunyi.
 */
export function MobileMainScrollShell({ children, className, contentClassName }: MobileMainScrollShellProps) {
  return (
    <div
      className={cn(
        "safe-area-top flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[hsl(var(--brand-white))]",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto",
          scrollHide,
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
