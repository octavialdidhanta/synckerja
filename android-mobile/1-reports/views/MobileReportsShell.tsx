import type { ReactNode } from "react";
import { MobileModuleBrandBar } from "@/shared/components/mobile/MobileModuleBrandBar";

export function MobileReportsShell({ children }: { children: ReactNode }) {
  return (
    <>
      <MobileModuleBrandBar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </>
  );
}
