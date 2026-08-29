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
 * Content is centered H+V with a capped width (not full-bleed).
 */
export function PosAuthViewport({ children, className, innerClassName }: PosAuthViewportProps) {
  return (
    <div
      className={cn(
        "flex min-h-dvh w-full flex-col bg-[#f7f7f7] safe-area-top",
        className,
      )}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className={cn("flex w-full max-w-md flex-col items-center", innerClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
