import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type PosAuthViewportProps = {
  children: ReactNode;
  className?: string;
  /** Extra classes on the centered max-width column. */
  innerClassName?: string;
};

/**
 * Full-viewport tablet-friendly shell for POS pre-auth screens.
 * Matches employee-welcome optical center (`h-dvh` + slight lift).
 */
export function PosAuthViewport({ children, className, innerClassName }: PosAuthViewportProps) {
  return (
    <div
      className={cn(
        "flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[#f7f7f7] safe-area-top",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-4">
        <div
          className={cn(
            "flex w-full max-w-md -translate-y-6 flex-col items-center gap-0 sm:-translate-y-8",
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
