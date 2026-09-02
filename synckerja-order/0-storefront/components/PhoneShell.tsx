import type { ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 justify-center overflow-hidden bg-neutral-200">
      <div className="relative flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-white shadow-xl">
        {children}
      </div>
    </div>
  );
}
