import type { ReactNode } from "react";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";

export function MobileHomeShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-center border-b border-border/60 bg-[hsl(var(--brand-white))] px-4 py-3">
        <SynckerjaBrandMark />
      </div>
      {children}
    </>
  );
}
